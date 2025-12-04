document.addEventListener('DOMContentLoaded', function () {
    const page = window.location.pathname.split('/').pop();
    const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
    
    // Se não há usuário logado e a página não é de login nem de ranking, redireciona para o login.
    if (!loggedInUser && !['login.html', 'ranking.html'].includes(page)) {
        window.location.href = 'login.html'; // A página de ranking é pública
        return;
    }

    if (loggedInUser) {
        if (page === 'login.html') {
            const targetPage = loggedInUser.role === 'admin' ? 'admin.html' : 'avaliacao.html';
            window.location.href = targetPage;
            return;
        }
        if (loggedInUser.role === 'admin' && !['admin.html', 'contest-details.html', 'ranking.html'].includes(page)) {
            window.location.href = 'admin.html';
            return;
        }
        else if (loggedInUser.role === 'evaluator' && page !== 'avaliacao.html') {
            window.location.href = 'avaliacao.html';
            return;
        }
    }

    const customAlert = document.getElementById('custom-alert');
    const customAlertMessage = document.getElementById('custom-alert-message');
    const customAlertClose = document.getElementById('custom-alert-close');

    function showCustomAlert(message, onOk) {
        customAlertMessage.textContent = message;
        customAlert.style.display = 'flex';
        setTimeout(() => customAlert.classList.add('visible'), 10);
 
        const okClickHandler = () => {
            customAlert.classList.remove('visible');
            setTimeout(() => customAlert.style.display = 'none', 300);
            if (onOk) onOk(); 
        };
        customAlertClose.addEventListener('click', okClickHandler, { once: true }); 
    }

    const customConfirm = document.getElementById('custom-confirm');
    const customConfirmMessage = document.getElementById('custom-confirm-message');
    const customConfirmOk = document.getElementById('custom-confirm-ok');
    const customConfirmCancel = document.getElementById('custom-confirm-cancel');

    function showCustomConfirm(message, onConfirm) {
        customConfirmMessage.textContent = message;
        customConfirm.style.display = 'flex';
        setTimeout(() => customConfirm.classList.add('visible'), 10);
        
        
        customConfirmOk.addEventListener('click', () => {
            closeConfirm();
            onConfirm();
        }, { once: true }); 
    }

    const closeConfirm = () => {
        customConfirm.classList.remove('visible');
        setTimeout(() => customConfirm.style.display = 'none', 300);
    };

    if (customConfirmCancel) {
        customConfirmCancel.addEventListener('click', closeConfirm);
    }

    
    const spinnerOverlay = document.getElementById('spinner-overlay');

    function showSpinner() {
        if (spinnerOverlay) spinnerOverlay.style.display = 'flex';
    }

    function hideSpinner() {
        if (spinnerOverlay) spinnerOverlay.style.display = 'none';
    }

    
    switch (page) {
        case 'login.html':
            handleLoginPage();
            break;
        case 'admin.html':
            handleAdminPage();
            break;
        case 'contest-details.html':
            handleContestDetailsPage();
            break;
        case 'avaliacao.html':
            handleEvaluationPage();
            break;
        case 'ranking.html':
            handleRankingPage();
            break;
    }


    function handleLoginPage() {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async function (e) {
                e.preventDefault();
                const username = e.target.username.value; 
                const password = e.target.password.value; 

                showSpinner();
                try {
                    const result = await loginUser(username, password);

                    if (result.status === 'success' && result.user) {
                        localStorage.setItem('loggedInUser', JSON.stringify(result.user));
                        if (result.user.role === 'admin') {
                            window.location.href = 'admin.html';
                        } else {
                            window.location.href = 'avaliacao.html';
                        }
                    } else {
                        hideSpinner(); 
                        const errorMessage = result.message || 'Usuário ou senha inválidos!';
                        showCustomAlert(errorMessage);
                    }
                } catch (error) {
                    hideSpinner();
                    showCustomAlert('Ocorreu um erro inesperado durante o login.');
                }
            });
        }
    }

    async function handleAdminPage() {
        const logoutButton = document.getElementById('logout-button');
        if (logoutButton) logoutButton.addEventListener('click', logout);

        
        const loggedInUsername = loggedInUser.username; 
        
        const addUserForm = document.getElementById('add-user-form');
        addUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = e.target['user-email'].value;
            const password = e.target['user-password'].value;
            const role = e.target['user-role'].value;

            if (password.length < 6) {
                showCustomAlert('A senha deve ter no mínimo 6 caracteres.');
                return;
            }

            showSpinner();
            try {
                const result = await registerNewUser(email, password, role);
                if (result.status === 'success') {
                    showCustomAlert(result.message || 'Usuário registrado com sucesso!');
                    addUserForm.reset();
                } else {
                    showCustomAlert(`Erro ao registrar usuário: ${result.message}`);
                }
                await renderUsers(); 
            } finally {
                hideSpinner();
            }
        });

        // --- Nova Lógica de Gerenciamento de Concursos ---
        const createContestForm = document.getElementById('create-contest-form');
        createContestForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = e.target['contest-name'].value;
            const description = e.target['contest-description'].value;

            showSpinner();
            try {
                await createContest(name, description, loggedInUser.username);
                showCustomAlert('Concurso criado com sucesso!');
                createContestForm.reset();
                await renderContests(); // Atualiza a lista de concursos
            } catch (error) {
                console.error('Erro ao criar concurso:', error);
                showCustomAlert('Ocorreu um erro ao criar o concurso.');
            } finally {
                hideSpinner();
            }
        });

        // Lógica para o modal de edição de concurso
        const editContestModal = document.getElementById('edit-contest-modal');
        const editContestForm = document.getElementById('edit-contest-form');
        const editContestCancelBtn = document.getElementById('edit-contest-cancel');

        function openEditContestModal(contest) {
            document.getElementById('edit-contest-id').value = contest.id;
            document.getElementById('edit-contest-name').value = contest.name;
            document.getElementById('edit-contest-description').value = contest.description || '';
            editContestModal.style.display = 'flex';
            setTimeout(() => editContestModal.classList.add('visible'), 10);
        }

        function closeEditContestModal() {
            editContestModal.classList.remove('visible');
            setTimeout(() => editContestModal.style.display = 'none', 300);
        }

        editContestCancelBtn.addEventListener('click', closeEditContestModal);

        editContestForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const contestId = document.getElementById('edit-contest-id').value;
            const name = document.getElementById('edit-contest-name').value;
            const description = document.getElementById('edit-contest-description').value;
            showSpinner();
            await updateContestDetails(contestId, name, description);
            hideSpinner();
            closeEditContestModal();
            showCustomAlert('Concurso atualizado com sucesso!');
            await renderContests();
        });

        // --- Fim da Nova Lógica ---


        const usersTableBody = document.querySelector('#users-table tbody');

        async function renderUsers() {
            showSpinner();
            usersTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Carregando usuários...</td></tr>';
            try {
                const users = await fetchUsers(); 

                if (users.length === 0) {
                    usersTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Nenhum usuário cadastrado.</td></tr>';
                    return;
                }

                usersTableBody.innerHTML = ''; 
                users.forEach(user => {
                const row = usersTableBody.insertRow();
                row.insertCell(0).textContent = user.username;
                row.insertCell(1).textContent = user.role === 'admin' ? 'Administrador' : 'Avaliador';

                const actionsCell = row.insertCell(2);
                const deleteButton = document.createElement('button');
                deleteButton.textContent = 'Excluir';
                deleteButton.className = 'btn remove-btn';
                deleteButton.dataset.username = user.username;

                
                if (user.username === 'admin' && loggedInUsername !== 'admin') {
                    
                    deleteButton.disabled = true;
                    deleteButton.title = 'Você não pode deletar o administrador principal.';
                } else if (user.username === loggedInUsername) {
                    
                    deleteButton.disabled = true;
                    deleteButton.title = 'Você não pode deletar sua própria conta.';
                }

                deleteButton.addEventListener('click', async () => {
                    showCustomConfirm(`Tem certeza que deseja excluir o usuário '${user.username}'?`, async () => {
                        showSpinner();
                        try {
                            const result = await deleteUser(user.username, loggedInUsername);
                            if (result.status === 'success') {
                                showCustomAlert(result.message || `Usuário '${user.username}' excluído com sucesso!`);
                                await renderUsers(); 
                            } else {
                                showCustomAlert(`Erro ao excluir usuário: ${result.message}`);
                            }
                        } catch (error) {
                            console.error('Erro ao excluir usuário:', error);
                            showCustomAlert(`Erro inesperado ao excluir usuário: ${error.message}`);
                        } finally {
                            hideSpinner();
                        }
                    });
                });
                actionsCell.appendChild(deleteButton);
            });
            } finally {
                hideSpinner();
            }
        }

        
        

        
        const tabButtons = document.querySelectorAll('.tab-navigation .tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        async function showTab(tabId) {
            tabContents.forEach(content => {
                content.classList.remove('active');
            });
            tabButtons.forEach(button => {
                button.classList.remove('active');
            });

            document.getElementById(tabId).classList.add('active');
            document.querySelector(`.tab-button[data-tab="${tabId}"]`).classList.add('active');

            
            if (tabId === 'user-management-tab') {
                await renderUsers(); 
            } else if (tabId === 'contest-management-tab') {
                await renderContests();
            }
        }

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                showTab(button.dataset.tab);
            });
        });

        async function initialLoad() {
            showSpinner();
            try {
                // Não precisamos mais buscar fotos ou usuários globais no carregamento inicial da página de admin
                // A busca será feita quando a respectiva aba for aberta.
                await showTab('user-management-tab'); 
            } finally {
                hideSpinner();
            }
        }
        await initialLoad();

        async function renderContests() {
            const contestsListDiv = document.getElementById('contests-list');
            contestsListDiv.innerHTML = '<p>Carregando concursos...</p>';
            showSpinner();
            try {
                const contests = await fetchContests();
                if (contests.length === 0) {
                    contestsListDiv.innerHTML = '<p>Nenhum concurso criado ainda.</p>';
                    return;
                }

                contestsListDiv.innerHTML = '';
                contests.forEach(contest => {
                    const contestCard = document.createElement('div');
                    contestCard.className = 'contest-card';
                    const statusLabels = {
                        draft: 'Rascunho',
                        open: 'Aberto',
                        closed: 'Fechado'
                    };

                    contestCard.innerHTML = `
                        <h3>${contest.name}</h3>
                        <p>${contest.description || 'Sem descrição.'}</p>
                        <div class="contest-card-footer">
                            <div class="status-control">
                                <label for="status-select-${contest.id}">Status:</label>
                                <select id="status-select-${contest.id}" data-contest-id="${contest.id}" class="status-select">
                                    <option value="draft" ${contest.status === 'draft' ? 'selected' : ''}>${statusLabels.draft}</option>
                                    <option value="open" ${contest.status === 'open' ? 'selected' : ''}>${statusLabels.open}</option>
                                    <option value="closed" ${contest.status === 'closed' ? 'selected' : ''}>${statusLabels.closed}</option>
                                </select>
                            </div>
                            <div class="contest-card-actions">
                                <button class="btn btn-secondary edit-contest-btn" data-contest-id="${contest.id}">Editar</button>
                                <a href="contest-details.html?id=${contest.id}" class="btn">Gerenciar</a>
                                <button class="btn btn-danger delete-contest-btn" data-contest-id="${contest.id}">Excluir</button>
                            </div>
                        </div>
                    `;
                    contestsListDiv.appendChild(contestCard);
                });

                // Adiciona os event listeners para os selects de status
                document.querySelectorAll('.status-select').forEach(select => {
                    select.addEventListener('change', async (e) => {
                        const contestId = e.target.dataset.contestId;
                        const newStatus = e.target.value;
                        const newStatusLabel = e.target.options[e.target.selectedIndex].text;

                        showCustomConfirm(`Deseja alterar o status do concurso para "${newStatusLabel}"?`, async () => {
                            showSpinner();
                            await updateContestStatus(contestId, newStatus);
                            hideSpinner();
                            showCustomAlert('Status atualizado com sucesso!');
                        });
                    });
                });

                document.querySelectorAll('.edit-contest-btn').forEach(button => {
                    button.addEventListener('click', (e) => {
                        const contestId = e.target.dataset.contestId;
                        const contest = contests.find(c => c.id === contestId);
                        openEditContestModal(contest);
                    });
                });

                document.querySelectorAll('.delete-contest-btn').forEach(button => {
                    button.addEventListener('click', (e) => {
                        const contestId = e.target.dataset.contestId;
                        const contest = contests.find(c => c.id === contestId);
                        showCustomConfirm(`Tem certeza que deseja excluir o concurso "${contest.name}"? TODOS os dados (categorias, fotos, avaliações) serão perdidos permanentemente.`, async () => {
                            showSpinner();
                            const result = await deleteContest(contestId);
                            hideSpinner();
                            showCustomAlert(result.message);
                            if (result.status === 'success') await renderContests();
                        });
                    });
                });

            } catch (error) {
                console.error('Erro ao renderizar concursos:', error);
                contestsListDiv.innerHTML = '<p class="error-message">Não foi possível carregar os concursos.</p>';
            } finally {
                hideSpinner();
            }
        }
    }

    async function handleContestDetailsPage() {
        const logoutButton = document.getElementById('logout-button');
        if (logoutButton) logoutButton.addEventListener('click', logout);

        const urlParams = new URLSearchParams(window.location.search);
        const contestId = urlParams.get('id');

        if (!contestId) {
            showCustomAlert('ID do concurso não encontrado. Redirecionando...', () => {
                window.location.href = 'admin.html';
            });
            return;
        }

        // Elementos da UI
        const contestTitleHeader = document.getElementById('contest-title-header');
        const addCategoryForm = document.getElementById('add-category-form');
        const categoriesList = document.getElementById('categories-list');
        const addPhotoForm = document.getElementById('add-photo-form');
        const photoCategorySelect = document.getElementById('photo-category');
        const contestPhotosGallery = document.getElementById('contest-photos-gallery');
        const addVoterForm = document.getElementById('add-voter-form');
        const voterUsernameSelect = document.getElementById('voter-username');
        const votersList = document.getElementById('voters-list');

        // Lógica de abas
        const tabButtons = document.querySelectorAll('.tab-navigation .tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        function showTab(tabId) {
            tabContents.forEach(content => content.classList.remove('active'));
            tabButtons.forEach(button => button.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            document.querySelector(`.tab-button[data-tab="${tabId}"]`).classList.add('active');
        }

        tabButtons.forEach(button => {
            button.addEventListener('click', () => showTab(button.dataset.tab));
        });

        // Funções de Renderização
        async function renderCategories() {
            const categories = await fetchCategories(contestId);
            categoriesList.innerHTML = '';
            photoCategorySelect.innerHTML = '<option value="">Selecione uma categoria...</option>';
            if (categories.length > 0) {
                categories.forEach(cat => {
                    const li = document.createElement('li');
                    li.innerHTML = `
                        <span class="item-name">${cat.name}</span>
                        <div class="item-actions">
                            <button class="edit-item-btn" data-id="${cat.id}" title="Editar categoria">&#9998;</button>
                            <button class="remove-item-btn" data-id="${cat.id}" title="Remover categoria">&times;</button>
                        </div>
                    `;

                    li.querySelector('.edit-item-btn').addEventListener('click', (e) => {
                        const span = e.currentTarget.closest('li').querySelector('.item-name');
                        const currentName = span.textContent;
                        const input = document.createElement('input');
                        input.type = 'text';
                        input.value = currentName;
                        input.className = 'inline-edit-input';
                        input.addEventListener('blur', async () => { // Salva ao perder o foco
                            const newName = input.value.trim();
                            if (newName && newName !== currentName) {
                                await updateCategoryName(contestId, cat.id, newName);
                            }
                            await renderCategories(); // Re-renderiza para restaurar o estado normal
                        });
                        input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') input.blur(); });

                        span.replaceWith(input);
                        input.focus();
                    });

                    li.querySelector('.remove-item-btn').addEventListener('click', () => {
                        showCustomConfirm(`Tem certeza que deseja remover a categoria "${cat.name}"? As fotos nesta categoria NÃO serão removidas.`, async () => {
                            showSpinner();
                            await deleteCategory(contestId, cat.id);
                            hideSpinner();
                            await renderCategories();
                        });
                    });
                    categoriesList.appendChild(li);

                    const option = document.createElement('option');
                    option.value = cat.id;
                    option.textContent = cat.name;
                    photoCategorySelect.appendChild(option);
                });
            } else {
                categoriesList.innerHTML = '<li>Nenhuma categoria criada ainda.</li>';
            }
        }

        async function renderPhotos() {
            const photos = await fetchPhotosForContest(contestId);
            contestPhotosGallery.innerHTML = '';
            if (photos.length > 0) {
                photos.forEach(photo => {
                    const photoCard = document.createElement('div');
                    photoCard.className = 'photo-card-admin';
                    photoCard.innerHTML = `
                        <button class="remove-item-btn" data-id="${photo.id}" data-drive-id="${photo.driveFileId}" title="Remover foto">&times;</button>
                        <img src="${photo.url}" alt="Foto de ${photo.authorName}">
                        <p>${photo.authorName || 'Anônimo'}</p>
                    `;
                    photoCard.querySelector('.remove-item-btn').addEventListener('click', () => {
                        showCustomConfirm(`Tem certeza que deseja remover esta foto? A ação não pode ser desfeita.`, async () => {
                            showSpinner();
                            await deletePhoto(contestId, photo.id, photo.driveFileId);
                            hideSpinner();
                            await renderPhotos();
                        });
                    });
                    contestPhotosGallery.appendChild(photoCard);
                });
            } else {
                contestPhotosGallery.innerHTML = '<p>Nenhuma foto adicionada a este concurso ainda.</p>';
            }
        }

        async function renderVoters() {
            const [allUsers, contestVoters] = await Promise.all([fetchUsers(), getContestVoters(contestId)]);
            
            votersList.innerHTML = '';
            if (contestVoters.length > 0) {
                contestVoters.forEach(username => {
                    const li = document.createElement('li');
                    li.innerHTML = `
                        <span class="item-name">${username}</span>
                        <div class="item-actions">
                            <button class="remove-item-btn" data-username="${username}" title="Remover avaliador">&times;</button>
                        </div>
                    `;
                    li.querySelector('.remove-item-btn').addEventListener('click', () => {
                        showCustomConfirm(`Tem certeza que deseja remover o avaliador "${username}" deste concurso?`, async () => {
                            showSpinner();
                            await removeVoterFromContest(contestId, username);
                            hideSpinner();
                            await renderVoters();
                        });
                    });
                    votersList.appendChild(li);
                });
            } else {
                votersList.innerHTML = '<li>Nenhum avaliador adicionado a este concurso.</li>';
            }

            voterUsernameSelect.innerHTML = '<option value="">Selecione um usuário...</option>';
            allUsers
                .filter(user => user.role === 'evaluator' && !contestVoters.includes(user.username))
                .forEach(user => {
                    const option = document.createElement('option');
                    option.value = user.username;
                    option.textContent = user.username;
                    voterUsernameSelect.appendChild(option);
                });
        }

        // Event Listeners dos Formulários
        addCategoryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const categoryName = e.target['category-name'].value;
            showSpinner();
            try {
                await createCategory(contestId, categoryName);
                showCustomAlert('Categoria criada com sucesso!');
                addCategoryForm.reset();
                await renderCategories();
            } catch (error) {
                showCustomAlert('Erro ao criar categoria.');
            } finally {
                hideSpinner();
            }
        });

        addPhotoForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const file = e.target['photo-file'].files[0];
            const categoryId = e.target['photo-category'].value;
            const authorName = e.target['photo-author'].value;
            
            // Obtém os nomes para a criação das pastas no Drive
            const contestName = contestTitleHeader.textContent;
            const categoryName = photoCategorySelect.options[photoCategorySelect.selectedIndex].text;


            if (!file || !categoryId || !contestName || !categoryName) {
                showCustomAlert('Por favor, selecione um arquivo e uma categoria válidos.');
                return;
            }
            showSpinner();
            try {
                await uploadPhoto(contestId, categoryId, file, authorName, contestName, categoryName);
                showCustomAlert('Foto adicionada com sucesso!');
                addPhotoForm.reset();
                await renderPhotos();
            } catch (error) {
                showCustomAlert('Erro ao adicionar foto.');
                console.error(error);
            } finally {
                hideSpinner();
            }
        });

        addVoterForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = e.target['voter-username'].value;
            if (!username) return;
            showSpinner();
            try {
                await addVoterToContest(contestId, username);
                showCustomAlert('Avaliador adicionado com sucesso!');
                addVoterForm.reset();
                await renderVoters();
            } catch (error) {
                showCustomAlert('Erro ao adicionar avaliador.');
            } finally {
                hideSpinner();
            }
        });

        // Carregamento Inicial
        async function initialLoad() {
            showSpinner();
            try {
                const contests = await fetchContests();
                const currentContest = contests.find(c => c.id === contestId);
                if (currentContest) {
                    contestTitleHeader.textContent = currentContest.name;
                }
                await Promise.all([renderCategories(), renderPhotos(), renderVoters()]);
            } catch (error) {
                console.error("Erro ao carregar dados do concurso:", error);
                showCustomAlert("Não foi possível carregar os detalhes do concurso.");
            } finally {
                hideSpinner();
            }
        }

        await initialLoad();
    }

    async function handleEvaluationPage() {
        const logoutButton = document.getElementById('logout-button');
        if (logoutButton) logoutButton.addEventListener('click', logout);
    
        // Elementos da UI
        const contestSelect = document.getElementById('contest-select');
        const categorySelect = document.getElementById('category-select');
        const categorySelectionArea = document.getElementById('category-selection-area');
        const evaluationContent = document.getElementById('evaluation-content');
        const photoImg = document.getElementById('photo-to-evaluate');
        const photoInfo = document.getElementById('photo-info');
        const prevBtn = document.getElementById('prev-photo');
        const nextBtn = document.getElementById('next-photo');
        const evaluationForm = document.getElementById('evaluation-form');
        const sliders = document.querySelectorAll('.criterion input[type="range"]');
        const currentCategoryTitle = document.getElementById('current-category-title');
        const evaluatedMessageDiv = document.getElementById('already-evaluated-message');
    
        // Estado da aplicação
        let allContestPhotos = [];
        let photosByCategory = {};
        let currentContestId = null;
        let currentCategoryId = null;
        let currentPhotoIndex = 0;
    
        // Funções de renderização e estado
        function displayCurrentPhoto() {
            const photosInCurrentCategory = photosByCategory[currentCategoryId] || [];
            if (photosInCurrentCategory.length === 0) {
                evaluationContent.style.display = 'none';
                showCustomAlert('Não há fotos nesta categoria para avaliar.');
                return;
            }
    
            evaluationContent.style.display = 'flex';
            const photo = photosInCurrentCategory[currentPhotoIndex];
            photoImg.src = photo.url;
            photoInfo.textContent = `Foto ${currentPhotoIndex + 1} de ${photosInCurrentCategory.length}`;
            prevBtn.disabled = currentPhotoIndex === 0;
            nextBtn.disabled = currentPhotoIndex === photosInCurrentCategory.length - 1;
    
            const existingEvaluation = photo.ratings.find(r => r.evaluator === loggedInUser.username);
            if (existingEvaluation) {
                sliders.forEach(slider => {
                    slider.value = existingEvaluation.scores[slider.id] || 5;
                    document.getElementById(`${slider.id}-value`).textContent = slider.value;
                });
                document.getElementById('comments').value = existingEvaluation.comments || '';
                setFormState(true, 'Avaliação Enviada');
                evaluatedMessageDiv.style.display = 'block';
                evaluatedMessageDiv.textContent = 'Você já avaliou esta foto.';
            } else {
                resetForm();
                setFormState(false, 'Enviar Avaliação');
                evaluatedMessageDiv.style.display = 'none';
            }
        }
    
        function setFormState(disabled, buttonText) {
            sliders.forEach(slider => slider.disabled = disabled);
            document.getElementById('comments').disabled = disabled;
            const submitBtn = evaluationForm.querySelector('button[type="submit"]');
            submitBtn.disabled = disabled;
            submitBtn.textContent = buttonText;
            evaluationForm.classList.toggle('evaluated', disabled);
        }
    
        function resetForm() {
            evaluationForm.reset();
            sliders.forEach(slider => {
                document.getElementById(`${slider.id}-value`).textContent = slider.value;
            });
        }
    
        // Event Listeners
        contestSelect.addEventListener('change', async () => {
            currentContestId = contestSelect.value;
            evaluationContent.style.display = 'none';
            categorySelectionArea.style.display = 'none';
            categorySelect.innerHTML = '<option value="">Carregando...</option>';
    
            if (!currentContestId) return;
    
            showSpinner();
            try {
                const [categories, photos] = await Promise.all([
                    fetchCategories(currentContestId),
                    fetchPhotosForContest(currentContestId)
                ]);
    
                allContestPhotos = photos;
                photosByCategory = allContestPhotos.reduce((acc, photo) => {
                    if (!acc[photo.categoryId]) acc[photo.categoryId] = [];
                    acc[photo.categoryId].push(photo);
                    return acc;
                }, {});
    
                categorySelect.innerHTML = '<option value="">Selecione uma categoria...</option>';
                categories.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat.id;
                    option.textContent = cat.name;
                    categorySelect.appendChild(option);
                });
                categorySelectionArea.style.display = 'block';
            } catch (error) {
                showCustomAlert('Erro ao carregar dados do concurso.');
            } finally {
                hideSpinner();
            }
        });
    
        categorySelect.addEventListener('change', () => {
            currentCategoryId = categorySelect.value;
            currentPhotoIndex = 0;
            if (!currentCategoryId) {
                evaluationContent.style.display = 'none';
                return;
            }
            const categoryName = categorySelect.options[categorySelect.selectedIndex].text;
            currentCategoryTitle.textContent = categoryName;
            displayCurrentPhoto();
        });
    
        nextBtn.addEventListener('click', () => {
            const photosInCurrentCategory = photosByCategory[currentCategoryId] || [];
            if (currentPhotoIndex < photosInCurrentCategory.length - 1) {
                currentPhotoIndex++;
                displayCurrentPhoto();
            }
        });
    
        prevBtn.addEventListener('click', () => {
            if (currentPhotoIndex > 0) {
                currentPhotoIndex--;
                displayCurrentPhoto();
            }
        });
    
        sliders.forEach(slider => {
            slider.addEventListener('input', () => {
                document.getElementById(`${slider.id}-value`).textContent = slider.value;
            });
        });
    
        evaluationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            showCustomConfirm('Tem certeza que deseja enviar esta avaliação?', async () => {
                showSpinner();
                const currentPhoto = photosByCategory[currentCategoryId][currentPhotoIndex];
                const evaluation = {
                    photoId: currentPhoto.id,
                    evaluator: loggedInUser.username,
                    scores: {},
                    comments: document.getElementById('comments').value
                };
                sliders.forEach(slider => { evaluation.scores[slider.id] = slider.value; });
    
                try {
                    await saveContestEvaluation(currentContestId, evaluation);
                    
                    // Atualiza o estado local
                    const photoToUpdate = allContestPhotos.find(p => p.id === currentPhoto.id);
                    const ratingIndex = photoToUpdate.ratings.findIndex(r => r.evaluator === loggedInUser.username);
                    if (ratingIndex > -1) {
                        photoToUpdate.ratings[ratingIndex] = evaluation;
                    } else {
                        photoToUpdate.ratings.push(evaluation);
                    }
    
                    showCustomAlert('Avaliação enviada com sucesso!', () => {
                        if (nextBtn.disabled) {
                            showCustomAlert('Você avaliou todas as fotos desta categoria!');
                        } else {
                            nextBtn.click();
                        }
                    });
                    displayCurrentPhoto();
                } catch (error) {
                    showCustomAlert('Erro ao salvar avaliação.');
                } finally {
                    hideSpinner();
                }
            });
        });
    
        // Carregamento inicial da página
        async function initialLoad() {
            showSpinner();
            try {
                const contests = await fetchContestsForVoter(loggedInUser.username);
                contestSelect.innerHTML = '<option value="">Selecione um concurso...</option>';
                if (contests.length === 0) {
                    contestSelect.innerHTML = '<option value="">Nenhum concurso aberto para avaliação</option>';
                    showCustomAlert('No momento, não há concursos abertos para sua avaliação.');
                    return;
                }
                contests.forEach(contest => {
                    const option = document.createElement('option');
                    option.value = contest.id;
                    option.textContent = contest.name;
                    contestSelect.appendChild(option);
                });
            } catch (error) {
                console.error("Erro ao carregar concursos para o avaliador:", error);
                showCustomAlert('Não foi possível carregar os concursos.');
            } finally {
                hideSpinner();
            }
        }
    
        // Modal de imagem
        const imageModal = document.getElementById('image-modal');
        const modalImageContent = document.getElementById('modal-image-content');
        const closeModal = imageModal.querySelector('.image-modal-close');
    
        photoImg.addEventListener('click', () => {
            imageModal.style.display = 'flex';
            modalImageContent.src = photoImg.src;
        });
    
        const closeImageModal = () => {
            imageModal.style.display = 'none';
        };
    
        closeModal.addEventListener('click', closeImageModal);
        imageModal.addEventListener('click', (e) => {
            if (e.target === imageModal) closeImageModal();
        });

        await initialLoad();
    }

    async function handleRankingPage() {
        const contestSelect = document.getElementById('ranking-contest-select');
        const categorySelect = document.getElementById('ranking-category-select');
        const categoryFilterDiv = document.getElementById('ranking-category-filter');
        const rankingResultsSection = document.getElementById('ranking-results-section');
        const rankingList = document.getElementById('ranking-list');
        const exportCsvBtn = document.getElementById('export-csv-btn');

        let allContestPhotos = [];
        let contestCategories = [];

        // Carregamento inicial: busca concursos fechados
        async function initialLoad() {
            showSpinner();
            try {
                const contests = await fetchContests();
                const closedContests = contests.filter(c => c.status === 'closed');

                contestSelect.innerHTML = '<option value="">Selecione um concurso...</option>';
                if (closedContests.length === 0) {
                    contestSelect.innerHTML = '<option value="">Nenhum concurso finalizado</option>';
                    return;
                }
                closedContests.forEach(contest => {
                    const option = document.createElement('option');
                    option.value = contest.id;
                    option.textContent = contest.name;
                    contestSelect.appendChild(option);
                });
            } catch (error) {
                showCustomAlert('Não foi possível carregar os concursos.');
            } finally {
                hideSpinner();
            }
        }

        // Lógica de cálculo e renderização do ranking
        function renderRanking() {
            const selectedCategoryId = categorySelect.value;
            
            const photosToRank = selectedCategoryId === 'all'
                ? allContestPhotos
                : allContestPhotos.filter(p => p.categoryId === selectedCategoryId);

            const rankedPhotos = photosToRank.map(photo => {
                const numEvaluations = photo.ratings.length;
                let totalScoreSum = 0;
                
                photo.ratings.forEach(ev => {
                    let evaluationScoreSum = 0;
                    let criteriaCount = 0;
                    for (const crit in ev.scores) {
                        evaluationScoreSum += parseInt(ev.scores[crit], 10);
                        criteriaCount++;
                    }
                    // Média da avaliação individual
                    totalScoreSum += (criteriaCount > 0 ? (evaluationScoreSum / criteriaCount) : 0);
                });
                
                // Média geral da foto
                const overallAverage = numEvaluations > 0 ? (totalScoreSum / numEvaluations) : 0;
                
                return { ...photo, average: overallAverage, numEvaluations };
            }).sort((a, b) => b.average - a.average); // Ordena pela maior média

            rankingList.innerHTML = '';
            if (rankedPhotos.length === 0) {
                rankingList.innerHTML = '<li>Nenhuma foto encontrada para esta seleção.</li>';
                return;
            }

            rankedPhotos.forEach((photo, index) => {
                const category = contestCategories.find(c => c.id === photo.categoryId);
                const categoryName = category ? category.name : 'Sem Categoria';

                const listItem = document.createElement('li');
                listItem.className = 'photo-item';
                listItem.innerHTML = `
                    <div class="photo-item-header">
                         <span class="rank-position">${index + 1}º</span>
                         <img src="${photo.url}" alt="Foto de ${photo.authorName}">
                         <div class="photo-item-info">
                            <p><strong>Autor:</strong> ${photo.authorName || 'Anônimo'}</p>
                            <p><strong>Média Final:</strong> ${photo.average.toFixed(2)}</p>
                            <p><strong>Avaliações:</strong> ${photo.numEvaluations}</p>
                         </div>
                         <div class="photo-item-category">${categoryName}</div>
                    </div>
                `;
                rankingList.appendChild(listItem);
            });
        }

        // Event Listeners
        contestSelect.addEventListener('change', async () => {
            const contestId = contestSelect.value;
            categoryFilterDiv.style.display = 'none';
            rankingResultsSection.style.display = 'none';
            allContestPhotos = [];

            if (!contestId) return;

            showSpinner();
            try {
                const [categories, photos] = await Promise.all([
                    fetchCategories(contestId),
                    fetchPhotosForContest(contestId)
                ]);

                allContestPhotos = photos;
                contestCategories = categories;

                categorySelect.innerHTML = '<option value="all">Todas as Categorias</option>';
                categories.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat.id;
                    option.textContent = cat.name;
                    categorySelect.appendChild(option);
                });

                categoryFilterDiv.style.display = 'block';
                rankingResultsSection.style.display = 'block';
                renderRanking();

            } catch (error) {
                showCustomAlert('Erro ao carregar dados do concurso.');
            } finally {
                hideSpinner();
            }
        });

        categorySelect.addEventListener('change', renderRanking);

        exportCsvBtn.addEventListener('click', () => {
            const rankedPhotos = Array.from(rankingList.querySelectorAll('.photo-item')).map((item, index) => {
                const author = item.querySelector('.photo-item-info p:nth-child(1)').textContent.replace('Autor: ', '');
                const average = item.querySelector('.photo-item-info p:nth-child(2)').textContent.replace('Média Final: ', '');
                const evaluations = item.querySelector('.photo-item-info p:nth-child(3)').textContent.replace('Avaliações: ', '');
                const category = item.querySelector('.photo-item-category').textContent;
                return { pos: index + 1, author, average, evaluations, category };
            });

            if (rankedPhotos.length === 0) {
                showCustomAlert('Não há dados para exportar.');
                return;
            }

            const headers = ['Posição', 'Autor', 'Categoria', 'Média Final', 'Nº de Avaliações'];
            let csvContent = "data:text/csv;charset=utf-8," + headers.join(',') + '\n';

            rankedPhotos.forEach(photo => {
                const row = [photo.pos, `"${photo.author}"`, `"${photo.category}"`, photo.average, photo.evaluations];
                csvContent += row.join(',') + '\n';
            });

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `ranking_${contestSelect.options[contestSelect.selectedIndex].text}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });

        await initialLoad();
    }

    function logout() {
        localStorage.removeItem('loggedInUser');
        window.location.href = 'login.html';
    }
});