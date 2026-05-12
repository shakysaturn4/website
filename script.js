document.addEventListener('DOMContentLoaded', function() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const subTabButtons = document.querySelectorAll('.subtab-button');
    const authPanel = document.getElementById('auth-panel');
    const accountState = document.getElementById('account-state');
    const openLogin = document.getElementById('open-login');
    const openRegister = document.getElementById('open-register');
    const logoutButton = document.getElementById('logout-button');
    const authTabs = document.querySelectorAll('.auth-tab');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const authMessage = document.getElementById('auth-message');
    let focusableAuthElements = [];
    let firstAuthFocusable = null;
    let lastAuthFocusable = null;
    const topicForm = document.getElementById('topic-form');
    const galleryForm = document.getElementById('gallery-form');
    const questionForm = document.getElementById('question-form');
    const topicsList = document.getElementById('topics-list');
    const galleryItems = document.getElementById('gallery-items');
    const questionsList = document.getElementById('questions-list');
    const profileSummary = document.getElementById('profile-summary');
    const profileTopicsList = document.getElementById('profile-topics');
    const profileQuestionsList = document.getElementById('profile-questions');
    const profileGalleryList = document.getElementById('profile-gallery');

    function switchTab(tabId) {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        const button = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
        if (button) button.classList.add('active');
        const tab = document.getElementById(tabId);
        if (tab) tab.classList.add('active');
    }

    function switchSubtab(subtabId) {
        subTabButtons.forEach(btn => btn.classList.remove('active'));
        const subtabs = document.querySelectorAll('.forum-subtab');
        subtabs.forEach(tab => tab.classList.remove('active'));
        const button = document.querySelector(`.subtab-button[data-subtab="${subtabId}"]`);
        if (button) button.classList.add('active');
        const subtab = document.getElementById(subtabId);
        if (subtab) subtab.classList.add('active');
    }

    function getUsers() {
        return JSON.parse(localStorage.getItem('users')) || [];
    }

    function saveUsers(users) {
        localStorage.setItem('users', JSON.stringify(users));
    }

    function getCurrentUser() {
        return JSON.parse(localStorage.getItem('currentUser'));
    }

    function setCurrentUser(user) {
        localStorage.setItem('currentUser', JSON.stringify(user));
    }

    function clearCurrentUser() {
        localStorage.removeItem('currentUser');
    }

    function isLoggedIn() {
        return !!getCurrentUser();
    }

    function updateFormAccess() {
        const canPost = isLoggedIn();
        const formControls = document.querySelectorAll('#topic-form input, #topic-form textarea, #topic-form select, #topic-form button, #gallery-form input, #gallery-form textarea, #gallery-form button, #question-form input, #question-form textarea, #question-form button');
        formControls.forEach(control => {
            control.disabled = !canPost;
        });

        const notes = document.querySelectorAll('.login-note');
        notes.forEach(note => {
            note.textContent = canPost
                ? 'You are signed in and can post content.'
                : 'Login to post topics, reply, or add gallery items.';
        });
    }

    function updateAccountUI() {
        const user = getCurrentUser();
        if (user) {
            accountState.innerHTML = `<strong>Signed in as ${user.username}</strong>${user.role === 'admin' ? ' <span class="admin-badge">👑 Admin</span>' : ''}`;
            logoutButton.classList.remove('hidden');
            openLogin.classList.add('hidden');
            openRegister.classList.add('hidden');
            authPanel.classList.remove('visible');
            authPanel.classList.add('hidden');
            document.body.classList.remove('modal-open');
            authMessage.textContent = '';
        } else {
            accountState.innerHTML = '<strong>Not signed in.</strong> Please login or register to post.';
            logoutButton.classList.add('hidden');
            openLogin.classList.remove('hidden');
            openRegister.classList.remove('hidden');
        }

        updateFormAccess();
        renderCurrentLists();
    }

    function renderCurrentLists() {
        loadTopics();
        loadQuestionTopics();
        loadGalleryItems();
        loadProfileData();
    }

    function showAuthMessage(message, type = 'info') {
        authMessage.textContent = message;
        authMessage.className = `auth-message ${type}`;
    }

    function loadProfileData() {
        const user = getCurrentUser();
        if (!profileSummary) return;

        if (!user) {
            profileSummary.innerHTML = '<p class="empty-state">Sign in to view your profile and manage your content.</p>';
            profileTopicsList.innerHTML = '<p class="empty-state">No topics yet. Your created topics will appear here.</p>';
            profileQuestionsList.innerHTML = '<p class="empty-state">No questions yet. Your asked questions will appear here.</p>';
            profileGalleryList.innerHTML = '<p class="empty-state">No gallery items yet. Your shared gallery entries will appear here.</p>';
            return;
        }

        const topics = JSON.parse(localStorage.getItem('forumTopics')) || [];
        const gallery = JSON.parse(localStorage.getItem('galleryItems')) || [];
        const userTopics = topics.map((topic, index) => ({ topic, index })).filter(entry => entry.topic.author === user.username);
        const userQuestions = userTopics.filter(entry => entry.topic.type === 'question');
        const userGallery = gallery.map((item, index) => ({ item, index })).filter(entry => entry.item.author === user.username);

        profileSummary.innerHTML = `
            <div class="profile-header">
                <div>
                    <strong>${user.username} ${user.role === 'admin' ? '<span class="admin-badge">👑 Admin</span>' : ''}</strong>
                    <p>${user.role === 'admin' ? 'Administrator account' : 'Regular account'}</p>
                    <p>Joined ${new Date((getUsers().find(u => u.username === user.username) || {}).createdAt || Date.now()).toLocaleDateString()}</p>
                </div>
                <div class="profile-stats">
                    <span>${userTopics.length} topics</span>
                    <span>${userQuestions.length} questions</span>
                    <span>${userGallery.length} gallery items</span>
                </div>
            </div>
        `;

        if (userTopics.length === 0) {
            profileTopicsList.innerHTML = '<p class="empty-state">You have not created any topics yet.</p>';
        } else {
            profileTopicsList.innerHTML = userTopics.map(({ topic, index }) => `
                <div class="profile-item">
                    <h4>${topic.title}</h4>
                    <p>${topic.body}</p>
                    <small>${topic.type} · posted on ${new Date(topic.timestamp).toLocaleDateString()}</small>
                    <div class="profile-actions">
                        <button class="action-button" type="button" onclick="editTopic(${index})">Edit</button>
                        <button class="action-button danger" type="button" onclick="deleteTopic(${index})">Delete</button>
                    </div>
                </div>
            `).join('');
        }

        if (userQuestions.length === 0) {
            profileQuestionsList.innerHTML = '<p class="empty-state">You have not asked any questions yet.</p>';
        } else {
            profileQuestionsList.innerHTML = userQuestions.map(({ topic, index }) => `
                <div class="profile-item">
                    <h4>${topic.title}</h4>
                    <p>${topic.body}</p>
                    <small>asked on ${new Date(topic.timestamp).toLocaleDateString()}</small>
                    <div class="profile-actions">
                        <button class="action-button" type="button" onclick="editTopic(${index})">Edit</button>
                        <button class="action-button danger" type="button" onclick="deleteTopic(${index})">Delete</button>
                    </div>
                </div>
            `).join('');
        }

        if (userGallery.length === 0) {
            profileGalleryList.innerHTML = '<p class="empty-state">You have not shared any gallery items yet.</p>';
        } else {
            profileGalleryList.innerHTML = userGallery.map(({ item, index }) => `
                <div class="profile-item">
                    <h4>${item.title}</h4>
                    <p>${item.description}</p>
                    <small>shared on ${new Date(item.timestamp).toLocaleDateString()}</small>
                    <div class="profile-actions">
                        <button class="action-button" type="button" onclick="editGalleryItem(${index})">Edit</button>
                        <button class="action-button danger" type="button" onclick="deleteGalleryItem(${index})">Delete</button>
                    </div>
                </div>
            `).join('');
        }
    }

    function selectAuthTab(mode) {
        authTabs.forEach(tab => tab.classList.toggle('active', tab.getAttribute('data-auth') === mode));
        document.getElementById('login-panel').classList.toggle('active', mode === 'login');
        document.getElementById('register-panel').classList.toggle('active', mode === 'register');
        showAuthMessage('');
    }

    function handleAuthPanelClick(event) {
        if (event.target === authPanel) {
            closeAuthPanel();
        }
    }

    function handleAuthKeyDown(event) {
        if (event.key === 'Escape') {
            closeAuthPanel();
            return;
        }

        if (event.key === 'Tab' && focusableAuthElements.length) {
            const activeElement = document.activeElement;
            if (event.shiftKey) {
                if (activeElement === firstAuthFocusable || activeElement === authPanel) {
                    event.preventDefault();
                    lastAuthFocusable.focus();
                }
            } else {
                if (activeElement === lastAuthFocusable) {
                    event.preventDefault();
                    firstAuthFocusable.focus();
                }
            }
        }
    }

    function openAuthPanel(mode) {
        authPanel.classList.remove('hidden');
        document.body.classList.add('modal-open');
        document.addEventListener('keydown', handleAuthKeyDown);
        authPanel.addEventListener('click', handleAuthPanelClick);
        requestAnimationFrame(() => {
            authPanel.classList.add('visible');
            focusableAuthElements = Array.from(authPanel.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])'))
                .filter(el => !el.disabled && el.offsetParent !== null);
            firstAuthFocusable = focusableAuthElements[0] || document.getElementById('close-auth');
            lastAuthFocusable = focusableAuthElements[focusableAuthElements.length - 1] || document.getElementById('close-auth');
            if (firstAuthFocusable) firstAuthFocusable.focus();
        });
        selectAuthTab(mode);
    }

    function closeAuthPanel() {
        authPanel.classList.remove('visible');
        document.body.classList.remove('modal-open');
        authPanel.removeEventListener('click', handleAuthPanelClick);
        document.removeEventListener('keydown', handleAuthKeyDown);
        const hideAfterTransition = event => {
            if (event.target === authPanel) {
                authPanel.classList.add('hidden');
                authPanel.removeEventListener('transitionend', hideAfterTransition);
            }
        };
        authPanel.addEventListener('transitionend', hideAfterTransition);
        showAuthMessage('');
    }

    authTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            selectAuthTab(this.getAttribute('data-auth'));
        });
    });

    openLogin.addEventListener('click', () => openAuthPanel('login'));
    openRegister.addEventListener('click', () => openAuthPanel('register'));
    logoutButton.addEventListener('click', function() {
        clearCurrentUser();
        updateAccountUI();
    });
    document.getElementById('close-auth').addEventListener('click', closeAuthPanel);

    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        const users = getUsers();
        const user = users.find(entry => entry.username === username && entry.password === password);

        if (!user) {
            showAuthMessage('Invalid username or password.', 'error');
            return;
        }

        setCurrentUser({ username: user.username, role: user.role || 'user' });
        showAuthMessage(`Welcome back, ${user.username}!`, 'success');
        updateAccountUI();
    });

    registerForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const username = document.getElementById('register-username').value.trim();
        const password = document.getElementById('register-password').value;
        const adminCode = document.getElementById('register-code').value.trim();
        const confirmPassword = document.getElementById('register-confirm').value;

        if (username.length < 3) {
            showAuthMessage('Username must be at least 3 characters.', 'error');
            return;
        }

        if (password.length < 4) {
            showAuthMessage('Password must be at least 4 characters.', 'error');
            return;
        }

        if (password !== confirmPassword) {
            showAuthMessage('Passwords do not match.', 'error');
            return;
        }

        const users = getUsers();
        if (users.some(entry => entry.username === username)) {
            showAuthMessage('This username is already taken.', 'error');
            return;
        }

        const role = adminCode === 'letmein' ? 'admin' : 'user';
        users.push({ username, password, role, createdAt: Date.now() });
        saveUsers(users);
        setCurrentUser({ username, role });
        showAuthMessage(`Account created. Signed in as ${username}.`, 'success');
        updateAccountUI();
    });

    function loadTopics() {
        const topics = JSON.parse(localStorage.getItem('forumTopics')) || [];
        topicsList.innerHTML = '';

        if (topics.length === 0) {
            topicsList.innerHTML = '<p class="empty-state">No topics yet. Start the conversation by creating a topic.</p>';
            return;
        }

        topics.forEach((topic, index) => {
            const topicDiv = document.createElement('div');
            topicDiv.className = 'forum-thread';
            const typeLabel = topic.type === 'question' ? '<span class="topic-label question-label">Question</span>' : '<span class="topic-label discussion-label">Discussion</span>';
            const replyDisabled = !isLoggedIn() ? 'disabled' : '';
            const replyPlaceholder = isLoggedIn() ? 'Write a reply...' : 'Login to reply.';

            const currentUser = getCurrentUser();
            const isAuthor = currentUser && topic.author === currentUser.username;
            const canDelete = currentUser && (isAuthor || currentUser.role === 'admin');
            const topicActions = canDelete ? `
                <div class="profile-actions">
                    ${isAuthor ? `<button class="action-button" type="button" onclick="editTopic(${index})">Edit</button>` : ''}
                    <button class="action-button danger" type="button" onclick="deleteTopic(${index})">Delete</button>
                </div>
            ` : '';

            topicDiv.innerHTML = `
                <h3>${topic.title} ${typeLabel}</h3>
                <p>${topic.body}</p>
                <small>Posted by ${topic.author} on ${new Date(topic.timestamp).toLocaleString()}</small>
                ${topicActions}
                <div class="replies">
                    ${topic.replies.length > 0 ? `<p class="reply-count">${topic.replies.length} repl${topic.replies.length === 1 ? 'y' : 'ies'}</p>` : '<p class="reply-count">No replies yet.</p>'}
                    ${topic.replies.map(reply => `
                        <div class="answer-item">
                            <p>${reply.body}</p>
                            <small>Replied by ${reply.author} on ${new Date(reply.timestamp).toLocaleString()}</small>
                        </div>
                    `).join('')}
                </div>
                <div class="reply-form">
                    <textarea placeholder="${replyPlaceholder}" ${replyDisabled}></textarea>
                    <button type="button" onclick="addReply(this, ${index})" ${replyDisabled}>Submit Reply</button>
                </div>
            `;
            topicsList.appendChild(topicDiv);
        });
    }

    function loadQuestionTopics() {
        const topics = JSON.parse(localStorage.getItem('forumTopics')) || [];
        questionsList.innerHTML = '';
        const questionTopics = topics
            .map((topic, index) => ({ topic, index }))
            .filter(entry => entry.topic.type === 'question');

        if (questionTopics.length === 0) {
            questionsList.innerHTML = '<p class="empty-state">No questions yet. Post a question and other users can reply.</p>';
            return;
        }

        questionTopics.forEach(({ topic, index }) => {
            const topicDiv = document.createElement('div');
            topicDiv.className = 'qa-item';
            const replyDisabled = !isLoggedIn() ? 'disabled' : '';
            const replyPlaceholder = isLoggedIn() ? 'Write a reply...' : 'Login to reply.';

            const currentUser = getCurrentUser();
            const isAuthor = currentUser && topic.author === currentUser.username;
            const canDelete = currentUser && (isAuthor || currentUser.role === 'admin');
            const topicActions = canDelete ? `
                <div class="profile-actions">
                    ${isAuthor ? `<button class="action-button" type="button" onclick="editTopic(${index})">Edit</button>` : ''}
                    <button class="action-button danger" type="button" onclick="deleteTopic(${index})">Delete</button>
                </div>
            ` : '';

            topicDiv.innerHTML = `
                <h3>${topic.title} <span class="topic-label question-label">Question</span></h3>
                <p>${topic.body}</p>
                <small>Asked by ${topic.author} on ${new Date(topic.timestamp).toLocaleString()}</small>
                ${topicActions}
                <div class="replies">
                    ${topic.replies.length > 0 ? `<p class="reply-count">${topic.replies.length} repl${topic.replies.length === 1 ? 'y' : 'ies'}</p>` : '<p class="reply-count">No answers yet.</p>'}
                    ${topic.replies.map(reply => `
                        <div class="answer-item">
                            <p>${reply.body}</p>
                            <small>Answered by ${reply.author} on ${new Date(reply.timestamp).toLocaleString()}</small>
                        </div>
                    `).join('')}
                </div>
                <div class="reply-form">
                    <textarea placeholder="${replyPlaceholder}" ${replyDisabled}></textarea>
                    <button type="button" onclick="addReply(this, ${index})" ${replyDisabled}>Submit Reply</button>
                </div>
            `;
            questionsList.appendChild(topicDiv);
        });
    }

    function loadGalleryItems() {
        const items = JSON.parse(localStorage.getItem('galleryItems')) || [];
        galleryItems.innerHTML = '';

        if (items.length === 0) {
            galleryItems.innerHTML = '<p class="empty-state">No gallery items yet. Share screenshots or media in the gallery.</p>';
            return;
        }

        const currentUser = getCurrentUser();
        items.forEach((item, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'gallery-item';
            const isOwner = currentUser && item.author === currentUser.username;
            const canDelete = currentUser && (isOwner || currentUser.role === 'admin');
            const actions = canDelete ? `
                <div class="profile-actions">
                    ${isOwner ? `<button class="action-button" type="button" onclick="editGalleryItem(${index})">Edit</button>` : ''}
                    <button class="action-button danger" type="button" onclick="deleteGalleryItem(${index})">Delete</button>
                </div>
            ` : '';

            itemDiv.innerHTML = `
                <img src="${item.image}" alt="${item.title}">
                <h4>${item.title}</h4>
                <p>${item.description}</p>
                <small class="gallery-meta">Shared by ${item.author}</small>
                ${actions}
            `;
            galleryItems.appendChild(itemDiv);
        });
    }

    topicForm.addEventListener('submit', function(e) {
        e.preventDefault();
        if (!isLoggedIn()) {
            alert('Please login before creating a topic.');
            return;
        }

        const title = document.getElementById('topic-title').value.trim();
        const body = document.getElementById('topic-body').value.trim();
        const type = document.getElementById('topic-type').value;
        if (!title || !body) return;

        const user = getCurrentUser();
        const topics = JSON.parse(localStorage.getItem('forumTopics')) || [];
        topics.unshift({
            title,
            body,
            type,
            author: user.username,
            timestamp: Date.now(),
            replies: []
        });

        localStorage.setItem('forumTopics', JSON.stringify(topics));
        topicForm.reset();
        loadTopics();
        loadQuestionTopics();
        switchTab('forums');
        switchSubtab('forum-topics');
    });

    galleryForm.addEventListener('submit', function(e) {
        e.preventDefault();
        if (!isLoggedIn()) {
            alert('Please login before sharing a gallery item.');
            return;
        }

        const title = document.getElementById('gallery-title').value.trim();
        const image = document.getElementById('gallery-image').value.trim();
        const description = document.getElementById('gallery-description').value.trim();
        if (!title || !image || !description) return;

        const user = getCurrentUser();
        const items = JSON.parse(localStorage.getItem('galleryItems')) || [];
        items.unshift({
            title,
            image,
            description,
            author: user.username,
            timestamp: Date.now()
        });

        localStorage.setItem('galleryItems', JSON.stringify(items));
        galleryForm.reset();
        loadGalleryItems();
    });

    questionForm.addEventListener('submit', function(e) {
        e.preventDefault();
        if (!isLoggedIn()) {
            alert('Please login before asking a question.');
            return;
        }

        const title = document.getElementById('question-title').value.trim();
        const body = document.getElementById('question-body').value.trim();
        if (!title || !body) return;

        const user = getCurrentUser();
        const topics = JSON.parse(localStorage.getItem('forumTopics')) || [];
        topics.unshift({
            title,
            body,
            type: 'question',
            author: user.username,
            timestamp: Date.now(),
            replies: []
        });

        localStorage.setItem('forumTopics', JSON.stringify(topics));
        questionForm.reset();
        loadTopics();
        loadQuestionTopics();
        switchTab('qa');
    });

    window.addReply = function(button, index) {
        if (!isLoggedIn()) {
            alert('Please login before replying.');
            return;
        }

        const topics = JSON.parse(localStorage.getItem('forumTopics')) || [];
        const replyForm = button.closest('.reply-form');
        if (!replyForm) return;
        const replyTextarea = replyForm.querySelector('textarea');
        if (!replyTextarea) return;

        const replyBody = replyTextarea.value.trim();
        if (!replyBody) return;

        const user = getCurrentUser();
        topics[index].replies.push({ body: replyBody, author: user.username, timestamp: Date.now() });
        localStorage.setItem('forumTopics', JSON.stringify(topics));
        replyTextarea.value = '';
        loadTopics();
        loadQuestionTopics();
    };

    window.editTopic = function(index) {
        const topics = JSON.parse(localStorage.getItem('forumTopics')) || [];
        const topic = topics[index];
        const user = getCurrentUser();
        if (!topic || !user || topic.author !== user.username) return;

        const title = window.prompt('Update topic title:', topic.title);
        if (title === null) return;
        const body = window.prompt('Update topic body:', topic.body);
        if (body === null) return;
        const type = window.prompt('Update topic type (discussion/question):', topic.type) || topic.type;

        topic.title = title.trim() || topic.title;
        topic.body = body.trim() || topic.body;
        topic.type = type === 'question' ? 'question' : 'discussion';
        localStorage.setItem('forumTopics', JSON.stringify(topics));
        renderCurrentLists();
    };

    window.deleteTopic = function(index) {
        const topics = JSON.parse(localStorage.getItem('forumTopics')) || [];
        const topic = topics[index];
        const user = getCurrentUser();
        if (!topic || !user || (topic.author !== user.username && user.role !== 'admin')) return;
        if (!window.confirm('Delete this topic? This cannot be undone.')) return;

        topics.splice(index, 1);
        localStorage.setItem('forumTopics', JSON.stringify(topics));
        renderCurrentLists();
    };

    window.editGalleryItem = function(index) {
        const items = JSON.parse(localStorage.getItem('galleryItems')) || [];
        const item = items[index];
        const user = getCurrentUser();
        if (!item || !user || item.author !== user.username) return;

        const title = window.prompt('Update gallery title:', item.title);
        if (title === null) return;
        const image = window.prompt('Update gallery image URL:', item.image);
        if (image === null) return;
        const description = window.prompt('Update gallery description:', item.description);
        if (description === null) return;

        item.title = title.trim() || item.title;
        item.image = image.trim() || item.image;
        item.description = description.trim() || item.description;
        localStorage.setItem('galleryItems', JSON.stringify(items));
        renderCurrentLists();
    };

    window.deleteGalleryItem = function(index) {
        const items = JSON.parse(localStorage.getItem('galleryItems')) || [];
        const item = items[index];
        const user = getCurrentUser();
        if (!item || !user || (item.author !== user.username && user.role !== 'admin')) return;
        if (!window.confirm('Delete this gallery item? This cannot be undone.')) return;

        items.splice(index, 1);
        localStorage.setItem('galleryItems', JSON.stringify(items));
        renderCurrentLists();
    };

    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            switchTab(tabId);
        });
    });

    subTabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const subtabId = this.getAttribute('data-subtab');
            switchSubtab(subtabId);
        });
    });

    updateAccountUI();
});