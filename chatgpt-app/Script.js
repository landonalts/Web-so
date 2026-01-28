// Configuration
const CONFIG = {
    apiEndpoint: '/api/chat', // Vercel serverless function
    imageEndpoint: '/api/image',
    ttsEndpoint: '/api/tts',
    defaultModel: 'gpt-3.5-turbo',
    maxHistory: 20
};

// State
let state = {
    apiKey: '',
    currentChat: 'chat_' + Date.now(),
    chatHistory: {},
    currentModel: CONFIG.defaultModel,
    temperature: 0.7,
    maxTokens: 1000,
    customInstructions: '',
    isVoiceListening: false,
    isDarkMode: localStorage.getItem('darkMode') === 'true',
    isSidebarOpen: window.innerWidth > 768
};

// DOM Elements
const elements = {
    messageInput: document.getElementById('message-input'),
    sendButton: document.getElementById('send-button'),
    chatMessages: document.getElementById('chat-messages'),
    modelSelect: document.getElementById('model-select'),
    currentModel: document.getElementById('current-model'),
    voiceBtn: document.getElementById('voice-btn'),
    voiceStatus: document.getElementById('voice-status'),
    temperature: document.getElementById('temperature'),
    tempValue: document.getElementById('temp-value'),
    maxTokens: document.getElementById('max-tokens'),
    tokensValue: document.getElementById('tokens-value'),
    customInstructions: document.getElementById('custom-instructions'),
    chatHistory: document.getElementById('chat-history'),
    currentChatTitle: document.getElementById('current-chat-title')
};

// Initialize
function init() {
    // Load saved state
    loadState();
    
    // Initialize UI
    updateUI();
    
    // Initialize Select2
    $('.select2').select2({
        width: '100%',
        theme: state.isDarkMode ? 'dark' : 'default'
    });
    
    // Event Listeners
    setupEventListeners();
    
    // Auto-resize textarea
    elements.messageInput.addEventListener('input', autoResizeTextarea);
    
    // Check API status
    checkAPIStatus();
}

// Load saved state
function loadState() {
    const savedState = localStorage.getItem('chatgpt_state');
    if (savedState) {
        const parsed = JSON.parse(savedState);
        state = { ...state, ...parsed };
    }
    
    // Load chat history
    const savedHistory = localStorage.getItem('chatgpt_history');
    if (savedHistory) {
        state.chatHistory = JSON.parse(savedHistory);
        renderChatHistory();
    }
    
    // Load custom instructions
    const instructions = localStorage.getItem('custom_instructions');
    if (instructions) {
        state.customInstructions = instructions;
        elements.customInstructions.value = instructions;
    }
    
    // Apply dark mode
    if (state.isDarkMode) {
        document.body.setAttribute('data-theme', 'light');
    }
}

// Save state
function saveState() {
    localStorage.setItem('chatgpt_state', JSON.stringify({
        currentModel: state.currentModel,
        temperature: state.temperature,
        maxTokens: state.maxTokens,
        customInstructions: state.customInstructions,
        isDarkMode: state.isDarkMode
    }));
    
    localStorage.setItem('chatgpt_history', JSON.stringify(state.chatHistory));
}

// Setup event listeners
function setupEventListeners() {
    // Send message
    elements.sendButton.addEventListener('click', sendMessage);
    elements.messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Model change
    elements.modelSelect.addEventListener('change', (e) => {
        state.currentModel = e.target.value;
        elements.currentModel.textContent = e.target.value;
        saveState();
    });
    
    // Temperature change
    elements.temperature.addEventListener('input', (e) => {
        state.temperature = parseFloat(e.target.value);
        elements.tempValue.textContent = e.target.value;
        saveState();
    });
    
    // Max tokens change
    elements.maxTokens.addEventListener('input', (e) => {
        state.maxTokens = parseInt(e.target.value);
        elements.tokensValue.textContent = e.target.value;
        saveState();
    });
    
    // Custom instructions
    elements.customInstructions.addEventListener('input', () => {
        state.customInstructions = elements.customInstructions.value;
    });
    
    // Voice button
    elements.voiceBtn.addEventListener('click', toggleVoiceInput);
}

// Update UI
function updateUI() {
    // Update model display
    elements.currentModel.textContent = state.currentModel;
    elements.modelSelect.value = state.currentModel;
    
    // Update sliders
    elements.temperature.value = state.temperature;
    elements.tempValue.textContent = state.temperature;
    elements.maxTokens.value = state.maxTokens;
    elements.tokensValue.textContent = state.maxTokens;
    
    // Update theme
    if (state.isDarkMode) {
        document.body.setAttribute('data-theme', 'light');
    } else {
        document.body.removeAttribute('data-theme');
    }
}

// Send message
async function sendMessage() {
    const message = elements.messageInput.value.trim();
    if (!message) return;
    
    // Clear input
    elements.messageInput.value = '';
    autoResizeTextarea();
    
    // Add user message to UI
    addMessage(message, 'user');
    
    // Add to history
    if (!state.chatHistory[state.currentChat]) {
        state.chatHistory[state.currentChat] = {
            id: state.currentChat,
            title: message.substring(0, 30) + (message.length > 30 ? '...' : ''),
            messages: [],
            timestamp: Date.now()
        };
        renderChatHistory();
    }
    
    state.chatHistory[state.currentChat].messages.push({
        role: 'user',
        content: message
    });
    
    // Show typing indicator
    showTypingIndicator();
    
    try {
        // Prepare messages
        const messages = [];
        
        // Add custom instructions if set
        if (state.customInstructions.trim()) {
            messages.push({
                role: 'system',
                content: state.customInstructions
            });
        }
        
        // Add conversation history (last 10 messages)
        const history = state.chatHistory[state.currentChat].messages;
        const recentHistory = history.slice(-CONFIG.maxHistory);
        messages.push(...recentHistory);
        
        // Call API
        const response = await fetch(CONFIG.apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: state.currentModel,
                messages: messages,
                temperature: state.temperature,
                max_tokens: state.maxTokens,
                stream: false
            })
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Remove typing indicator
        removeTypingIndicator();
        
        // Add AI response
        if (data.error) {
            addMessage(`Error: ${data.error.message}`, 'error');
        } else {
            const aiMessage = data.choices[0].message.content;
            addMessage(aiMessage, 'bot');
            
            // Save to history
            state.chatHistory[state.currentChat].messages.push({
                role: 'assistant',
                content: aiMessage
            });
            
            // Update chat title if first response
            if (state.chatHistory[state.currentChat].messages.length === 2) {
                state.chatHistory[state.currentChat].title = 
                    message.substring(0, 30) + (message.length > 30 ? '...' : '');
                renderChatHistory();
            }
        }
        
    } catch (error) {
        removeTypingIndicator();
        addMessage(`Error: ${error.message}`, 'error');
        console.error('Chat error:', error);
    }
    
    // Save state
    saveState();
}

// Add message to UI
function addMessage(content, sender = 'user') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    
    if (sender === 'user') {
        avatar.innerHTML = '<i class="fas fa-user"></i>';
    } else if (sender === 'bot') {
        avatar.innerHTML = '<i class="fas fa-robot"></i>';
    } else {
        avatar.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
    }
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    
    elements.chatMessages.appendChild(messageDiv);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

// Show typing indicator
function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot';
    typingDiv.id = 'typing-indicator';
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = '<i class="fas fa-robot"></i>';
    
    const content = document.createElement('div');
    content.className = 'message-content';
    content.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    
    typingDiv.appendChild(avatar);
    typingDiv.appendChild(content);
    
    elements.chatMessages.appendChild(typingDiv);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

// Remove typing indicator
function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

// Auto-resize textarea
function autoResizeTextarea() {
    const textarea = elements.messageInput;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}

// New chat
function newChat() {
    state.currentChat = 'chat_' + Date.now();
    elements.chatMessages.innerHTML = '';
    elements.currentChatTitle.textContent = 'New Chat';
    
    // Add welcome message
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'welcome-message';
    welcomeDiv.innerHTML = `
        <h3>Start a new conversation! 🚀</h3>
        <p>Select a model from the sidebar and start chatting.</p>
        <div class="quick-actions">
            <button class="quick-btn" onclick="quickPrompt('Write a Python function to...')">
                <i class="fab fa-python"></i> Code Help
            </button>
            <button class="quick-btn" onclick="quickPrompt('Explain quantum computing in simple terms')">
                <i class="fas fa-brain"></i> Explain
            </button>
            <button class="quick-btn" onclick="quickPrompt('Write a creative story about...')">
                <i class="fas fa-book"></i> Creative Writing
            </button>
        </div>
    `;
    
    elements.chatMessages.appendChild(welcomeDiv);
}

// Load chat
function loadChat(chatId) {
    state.currentChat = chatId;
    const chat = state.chatHistory[chatId];
    
    if (!chat) return;
    
    // Clear messages
    elements.chatMessages.innerHTML = '';
    elements.currentChatTitle.textContent = chat.title;
    
    // Add messages
    chat.messages.forEach(msg => {
        addMessage(msg.content, msg.role === 'user' ? 'user' : 'bot');
    });
    
    // Update chat history UI
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.chatId === chatId) {
            item.classList.add('active');
        }
    });
}

// Render chat history
function renderChatHistory() {
    const container = elements.chatHistory;
    container.innerHTML = '';
    
    const chats = Object.values(state.chatHistory)
        .sort((a, b) => b.timestamp - a.timestamp);
    
    chats.forEach(chat => {
        const item = document.createElement('div');
        item.className = `chat-item ${chat.id === state.currentChat ? 'active' : ''}`;
        item.dataset.chatId = chat.id;
        item.textContent = chat.title;
        item.onclick = () => loadChat(chat.id);
        container.appendChild(item);
    });
}

// Quick prompt
function quickPrompt(prompt) {
    elements.messageInput.value = prompt;
    autoResizeTextarea();
    elements.messageInput.focus();
}

// Toggle voice input
function toggleVoiceInput() {
    if (!('webkitSpeechRecognition' in window)) {
        alert('Speech recognition is not supported in your browser.');
        return;
    }
    
    if (state.isVoiceListening) {
        stopVoiceInput();
    } else {
        startVoiceInput();
    }
}

// Start voice input
function startVoiceInput() {
    const recognition = new (webkitSpeechRecognition || SpeechRecognition)();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    
    recognition.onstart = () => {
        state.isVoiceListening = true;
        elements.voiceBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
        elements.voiceStatus.style.display = 'flex';
    };
    
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        elements.messageInput.value = transcript;
        autoResizeTextarea();
    };
    
    recognition.onend = () => {
        stopVoiceInput();
    };
    
    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        stopVoiceInput();
    };
    
    state.recognition = recognition;
    recognition.start();
}

// Stop voice input
function stopVoiceInput() {
    if (state.recognition) {
        state.recognition.stop();
    }
    
    state.isVoiceListening = false;
    elements.voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
    elements.voiceStatus.style.display = 'none';
}

// Toggle dark mode
function toggleDarkMode() {
    state.isDarkMode = !state.isDarkMode;
    
    if (state.isDarkMode) {
        document.body.setAttribute('data-theme', 'light');
    } else {
        document.body.removeAttribute('data-theme');
    }
    
    saveState();
    
    // Update Select2 theme
    $('.select2').select2({
        theme: state.isDarkMode ? 'dark' : 'default'
    });
}

// Toggle sidebar
function toggleSidebar() {
    state.isSidebarOpen = !state.isSidebarOpen;
    document.querySelector('.sidebar').classList.toggle('open');
}

// Export chat
function exportChat() {
    const chat = state.chatHistory[state.currentChat];
    if (!chat || chat.messages.length === 0) {
        alert('No chat to export');
        return;
    }
    
    const exportData = {
        metadata: {
            title: chat.title,
            model: state.currentModel,
            exported: new Date().toISOString()
        },
        messages: chat.messages
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `chatgpt_export_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Import chat
function importChat() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                const chatId = 'imported_' + Date.now();
                
                state.chatHistory[chatId] = {
                    id: chatId,
                    title: importedData.metadata?.title || 'Imported Chat',
                    messages: importedData.messages || [],
                    timestamp: Date.now()
                };
                
                renderChatHistory();
                loadChat(chatId);
                saveState();
                
                alert('Chat imported successfully!');
            } catch (error) {
                alert('Error importing chat: Invalid format');
            }
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

// Generate image
async function generateDallEImage() {
    const prompt = document.getElementById('image-prompt').value;
    const size = document.getElementById('image-size').value;
    
    if (!prompt.trim()) {
        alert('Please enter a prompt');
        return;
    }
    
    try {
        const response = await fetch(CONFIG.imageEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: prompt,
                size: size,
                n: 1
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            alert(`Error: ${data.error.message}`);
            return;
        }
        
        const resultDiv = document.getElementById('image-result');
        resultDiv.innerHTML = '';
        
        data.data.forEach(image => {
            const img = document.createElement('img');
            img.src = image.url;
            img.className = 'generated-image';
            img.alt = prompt;
            resultDiv.appendChild(img);
        });
        
    } catch (error) {
        alert('Error generating image');
        console.error(error);
    }
}

// Text to speech
async function speakText(text) {
    try {
        const response = await fetch(CONFIG.ttsEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                voice: 'alloy'
            })
        });
        
        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audio.play();
        
    } catch (error) {
        console.error('TTS error:', error);
    }
}

// Speak last message
function speakLastMessage() {
    const messages = document.querySelectorAll('.message.bot .message-content');
    if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1].textContent;
        speakText(lastMessage);
    }
}

// Check API status
async function checkAPIStatus() {
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: 'Hello' }],
                max_tokens: 5
            })
        });
        
        if (response.ok) {
            document.querySelector('.status-dot').style.background = '#10a37f';
            document.getElementById('connection-status').textContent = 'Online';
        }
    } catch (error) {
        document.querySelector('.status-dot').style.background = '#e74c3c';
        document.getElementById('connection-status').textContent = 'Offline';
    }
}

// Toggle attachments
function toggleAttachments() {
    const menu = document.getElementById('attachment-menu');
    menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
}

// Generate image from text
function generateImageFromText() {
    const text = elements.messageInput.value;
    if (text.trim()) {
        document.getElementById('image-prompt').value = text;
        document.getElementById('image-modal').style.display = 'flex';
    }
}

// Close image modal
function closeImageModal() {
    document.getElementById('image-modal').style.display = 'none';
}

// API Key setup functions
function showApiSetup(type) {
    document.getElementById('vercel-setup').style.display = 
        type === 'vercel' ? 'block' : 'none';
    document.getElementById('direct-setup').style.display = 
        type === 'direct' ? 'block' : 'none';
}

function saveDirectApiKey() {
    const key = document.getElementById('direct-api-key').value.trim();
    if (key && key.startsWith('sk-')) {
        localStorage.setItem('openai_api_key', key);
        document.getElementById('api-modal').style.display = 'none';
        alert('API key saved for this session!');
    } else {
        alert('Please enter a valid OpenAI API key (starts with sk-)');
    }
}

function demoMode() {
    document.getElementById('api-modal').style.display = 'none';
    addMessage('Demo mode activated! For full features, please add your API key.', 'system');
}

// Initialize on load
window.addEventListener('DOMContentLoaded', init);

// Make functions globally available
window.newChat = newChat;
window.quickPrompt = quickPrompt;
window.toggleVoiceInput = toggleVoiceInput;
window.toggleDarkMode = toggleDarkMode;
window.toggleSidebar = toggleSidebar;
window.exportChat = exportChat;
window.importChat = importChat;
window.generateDallEImage = generateDallEImage;
window.speakLastMessage = speakLastMessage;
window.toggleAttachments = toggleAttachments;
window.generateImageFromText = generateImageFromText;
window.closeImageModal = closeImageModal;
window.showApiSetup = showApiSetup;
window.saveDirectApiKey = saveDirectApiKey;
window.demoMode = demoMode;
