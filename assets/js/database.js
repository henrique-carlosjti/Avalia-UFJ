


firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();


const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxA1NjkAe8U9QhQkDO0I_BPTvl8jzQTsUikvkqYbr9nJUaSniUd0xJqRgQBY8JgCtDm/exec';


const FAKE_EMAIL_DOMAIN = '@seu-olhar.app';

let photos = {}; // [DEPRECATED] - Será substituído por um estado local nas páginas.

/**
 * Registra um novo usuário no Firebase Authentication e armazena seus dados no Firestore.
 * Apenas para administradores.
 */
async function registerNewUser(email, password, role) {
    try {
        const username = email.toLowerCase();
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ 
                action: 'registerUser', 
                payload: { username, password, role } 
            }),
            mode: 'cors'
        });

        const result = await response.json();
        
        if (result.status === 'success') {
            return { status: 'success', message: result.message };
        }
        
    } catch (error) {
        console.error("Erro ao chamar o backend para registrar usuário:", error);
        return { status: 'error', message: error.message };
    }
}

/**
 * Busca todos os usuários cadastrados no Firestore.
 */
async function fetchUsers() {
    try {
        const snapshot = await db.collection('users').get();
        return snapshot.docs.map(doc => doc.data());
    } catch (error) {
        console.error("Erro ao buscar usuários do Firestore:", error);
        throw error;
    }
}

/**
 * Deleta um usuário do Firebase Auth e Firestore via backend.
 */
async function deleteUser(usernameToDelete, loggedInUsername) {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ 
            action: 'deleteUser', 
            payload: { usernameToDelete, loggedInUsername } }),
        mode: 'cors'
    });
    return response.json();
}

/**
 * Realiza o login do usuário com Firebase Authentication.
 */
async function loginUser(email, password) {
    const username = email.toLowerCase();
    const internalEmail = username + FAKE_EMAIL_DOMAIN;
    try {
        const userCredential = await auth.signInWithEmailAndPassword(internalEmail, password);
        const user = userCredential.user;

        
        
        
        
        const userDoc = await db.collection('users').doc(username).get();
        if (!userDoc.exists) {
            throw new Error("Dados do usuário não encontrados no banco de dados.");
        }
        const userData = userDoc.data();

        return {
            status: 'success',
            user: {
                username: userData.username,
                role: userData.role
            }
        };
    } catch (error) {
        console.error('Erro durante o login:', error.code, error.message);
        
        if (error.code === 'auth/invalid-login-credentials' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            return { status: 'error', message: 'Usuário ou senha inválidos. Verifique os dados e tente novamente.' };
        }
        
        return { status: 'error', message: `Erro de login: ${error.message}` };
    }
}

// ===================================================================
// NOVA ARQUITETURA - MÚLTIPLOS CONCURSOS
// ===================================================================

/**
 * Cria um novo concurso no Firestore.
 */
async function createContest(name, description, ownerId) {
    const contestRef = db.collection('contests').doc();
    await contestRef.set({
        id: contestRef.id,
        name,
        description,
        ownerId,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'draft' // 'draft', 'open', 'closed'
    });
    return contestRef.id;
}

/**
 * Atualiza o status de um concurso.
 * @param {string} contestId O ID do concurso.
 * @param {'draft' | 'open' | 'closed'} newStatus O novo status.
 */
async function updateContestStatus(contestId, newStatus) {
    const contestRef = db.collection('contests').doc(contestId);
    await contestRef.update({ status: newStatus });
}

/**
 * Atualiza os detalhes de um concurso (nome e descrição).
 */
async function updateContestDetails(contestId, name, description) {
    const contestRef = db.collection('contests').doc(contestId);
    await contestRef.update({ name, description });
}

/**
 * Deleta um concurso e todos os seus dados associados via backend.
 */
async function deleteContest(contestId) {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
            action: 'deleteContest',
            payload: { contestId }
        }),
        mode: 'cors'
    });
    return response.json();
}

/**
 * Busca todos os concursos.
 */
async function fetchContests() {
    const snapshot = await db.collection('contests').orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => doc.data());
}

/**
 * Cria uma nova categoria para um concurso específico.
 */
async function createCategory(contestId, categoryName) {
    const categoryRef = db.collection('contests').doc(contestId).collection('categories').doc();
    await categoryRef.set({
        id: categoryRef.id,
        name: categoryName
    });
    return categoryRef.id;
}

/**
 * Deleta uma categoria de um concurso.
 */
async function deleteCategory(contestId, categoryId) {
    const categoryRef = db.collection('contests').doc(contestId).collection('categories').doc(categoryId);
    await categoryRef.delete();
}

/**
 * Atualiza o nome de uma categoria.
 */
async function updateCategoryName(contestId, categoryId, newName) {
    const categoryRef = db.collection('contests').doc(contestId).collection('categories').doc(categoryId);
    await categoryRef.update({ name: newName });
}

/**
 * Busca todas as categorias de um concurso.
 */
async function fetchCategories(contestId) {
    const snapshot = await db.collection('contests').doc(contestId).collection('categories').get();
    return snapshot.docs.map(doc => doc.data());
}

/**
 * Faz o upload de uma foto para o Firebase Storage e cria o registro no Firestore.
 */
async function uploadPhoto(contestId, categoryId, file, authorName, contestName, categoryName) {
    // 1. Converte o arquivo para base64 para enviar via JSON
    const reader = new FileReader();
    const fileData = await new Promise((resolve, reject) => {
        reader.onloadend = () => {
            const base64String = reader.result.split(',')[1];
            resolve({
                base64: base64String,
                type: file.type,
                name: file.name
            });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
    var teste = { contestName, categoryName, fileData };
    console.log(teste);
    // 2. Envia os dados para o Google Apps Script
    const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
            action: 'uploadPhotoToDrive',
            payload: { contestName, categoryName, fileData }
        }),
        mode: 'cors'
    });
    const result = await response.json();

    if (result.status !== 'success') {
        throw new Error(result.message || 'Falha no upload para o Google Drive.');
    }

    // 3. Cria o documento da foto no Firestore com o ID do Drive
    const photoRef = db.collection('contests').doc(contestId).collection('photos').doc();
    await photoRef.set({
        id: photoRef.id,
        contestId,
        categoryId,
        authorName: authorName || 'Anônimo',
        url: `https://lh3.googleusercontent.com/d/${result.fileId}`, // URL de visualização do Drive
        driveFileId: result.fileId,
        ratings: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    return { id: photoRef.id, url: `https://lh3.googleusercontent.com/d/${result.fileId}` };
}

/**
 * Deleta uma foto do Firestore e do Google Drive.
 */
async function deletePhoto(contestId, photoId, driveFileId) {
    // 1. Deleta o arquivo do Google Drive via Apps Script
    if (driveFileId) {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'deleteFileFromDrive',
                payload: { driveFileId }
            }),
            mode: 'cors'
        });
        const result = await response.json();
        if (result.status !== 'success') {
            // Log do erro, mas continua para deletar do Firestore
            console.error('Falha ao deletar arquivo do Drive:', result.message);
        }
    }

    // 2. Deleta o documento da foto do Firestore
    const photoRef = db.collection('contests').doc(contestId).collection('photos').doc(photoId);
    await photoRef.delete();
}

/**
 * Busca todas as fotos de um concurso específico.
 */
async function fetchPhotosForContest(contestId) {
    const snapshot = await db.collection('contests').doc(contestId).collection('photos').get();
    return snapshot.docs.map(doc => doc.data());
}

/**
 * Adiciona um usuário à lista de avaliadores de um concurso.
 */
async function addVoterToContest(contestId, username) {
    const contestRef = db.collection('contests').doc(contestId);
    await contestRef.update({
        voters: firebase.firestore.FieldValue.arrayUnion(username)
    });
}

/**
 * Remove um usuário da lista de avaliadores de um concurso.
 */
async function removeVoterFromContest(contestId, username) {
    const contestRef = db.collection('contests').doc(contestId);
    await contestRef.update({
        voters: firebase.firestore.FieldValue.arrayRemove(username)
    });
}

/**
 * Busca a lista de avaliadores de um concurso.
 */
async function getContestVoters(contestId) {
    const doc = await db.collection('contests').doc(contestId).get();
    if (doc.exists) {
        return doc.data().voters || [];
    }
    return [];
}

/**
 * Busca os concursos nos quais um usuário específico é um avaliador.
 * Apenas concursos com status 'open' são retornados.
 */
async function fetchContestsForVoter(username) {
    const snapshot = await db.collection('contests')
        .where('voters', 'array-contains', username)
        .where('status', '==', 'open')
        .orderBy('createdAt', 'desc')
        .get();
    return snapshot.docs.map(doc => doc.data());
}

/**
 * Salva uma avaliação no documento da foto dentro de um concurso específico.
 */
async function saveContestEvaluation(contestId, evaluation) {
    try {
        const photoRef = db.collection('contests').doc(contestId).collection('photos').doc(evaluation.photoId);

        await db.runTransaction(async (transaction) => {
            const photoDoc = await transaction.get(photoRef);
            if (!photoDoc.exists) {
                throw "Documento da foto não encontrado!";
            }

            const data = photoDoc.data();
            const ratings = data.ratings || [];

            const existingEvalIndex = ratings.findIndex(r => r.evaluator === evaluation.evaluator);

            if (existingEvalIndex > -1) {
                ratings[existingEvalIndex] = evaluation;
            } else {
                ratings.push(evaluation);
            }

            transaction.update(photoRef, { ratings: ratings });
        });

        return { status: 'success' };
    } catch (error) {
        console.error('Erro ao salvar avaliação:', error);
        throw error;
    }
}

// ===================================================================
// FUNÇÕES ANTIGAS - MARCADAS PARA REMOÇÃO FUTURA
// ===================================================================

/**
 * [DEPRECATED] Busca todas as fotos e suas avaliações do Firestore.
 * Substituída por `fetchPhotosForContest(contestId)`.
 */
// async function fetchPhotos() { ... }

/**
 * [DEPRECATED] Salva uma avaliação no documento da foto correspondente no Firestore.
 * Será substituída por uma nova função que opera dentro de um concurso.
 */
// async function saveEvaluation(evaluation) { ... }

/**
 * [DEPRECATED] Chama o Google Apps Script para sincronizar fotos do Drive para o Firestore.
 * Substituída pela função `uploadPhoto`.
 */
// async function syncPhotosWithDrive() { ... }