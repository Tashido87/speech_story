document.addEventListener('DOMContentLoaded', () => {

    const GEMINI_API_KEY = "AIzaSyAwhaeum0GPgiZTd1e2x2SdFjAQeER8mEo";

    // DOM Elements
    const micBtn = document.getElementById('mic-btn');
    const sendBtn = document.getElementById('send-btn');
    const chatInput = document.getElementById('chat-input');
    const chatContainer = document.getElementById('chat-container');
    const welcomeMessage = document.getElementById('welcome-message');
    const recordingControls = document.getElementById('recording-controls');
    const pauseResumeBtn = document.getElementById('pause-resume-btn');
    const stopBtn = document.getElementById('stop-btn');
    const newStoryBtn = document.getElementById('new-story-btn');
    const historyList = document.getElementById('history-list');
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menu-toggle');
    const languageSelect = document.getElementById('language-select');

    // Speech Recognition Setup
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;
    let isRecording = false;
    let isPaused = false;

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = languageSelect.value;
        languageSelect.addEventListener('change', () => {
            recognition.lang = languageSelect.value;
        });
    } else {
        alert("Sorry, your browser doesn't support the Speech Recognition API.");
    }

    // App State
    let conversations = [];
    let currentConversationId = null;
    let finalTranscript = '';

    // --- Event Listeners ---
    menuToggle.addEventListener('click', () => sidebar.classList.toggle('-translate-x-full'));
    micBtn.addEventListener('click', toggleRecording);
    sendBtn.addEventListener('click', handleTextInput);
    stopBtn.addEventListener('click', stopRecording);
    pauseResumeBtn.addEventListener('click', togglePause);
    newStoryBtn.addEventListener('click', startNewStory);
    chatInput.addEventListener('input', () => {
        micBtn.classList.toggle('hidden', chatInput.value.trim() !== '');
        sendBtn.classList.toggle('hidden', chatInput.value.trim() === '');
    });
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleTextInput();
        }
    });

    // --- Core Functions ---
    function toggleRecording() {
        if (!SpeechRecognition) return;
        isRecording && !isPaused ? stopRecording() : startRecording();
    }

    function startRecording() {
        if (currentConversationId === null) startNewStory();
        welcomeMessage.classList.add('hidden');
        isRecording = true;
        isPaused = false;
        finalTranscript = '';
        recognition.start();
        micBtn.innerHTML = '<i class="fas fa-stop text-red-400"></i>';
        micBtn.classList.add('animate-pulse');
        recordingControls.classList.remove('hidden');
        recordingControls.classList.add('flex');
        pauseResumeBtn.innerHTML = '<i class="fas fa-pause"></i>';
    }
    
    function stopRecording() {
        if (!SpeechRecognition || !isRecording) return;
        isRecording = false;
        isPaused = false;
        recognition.stop();
    }

    function togglePause() {
        if (!isRecording) return;
        isPaused = !isPaused;
        if (isPaused) {
            recognition.stop();
            pauseResumeBtn.innerHTML = '<i class="fas fa-microphone"></i>';
            micBtn.classList.remove('animate-pulse');
        } else {
            recognition.start();
            pauseResumeBtn.innerHTML = '<i class="fas fa-pause"></i>';
            micBtn.classList.add('animate-pulse');
        }
    }
    
    function handleTextInput() {
        const text = chatInput.value.trim();
        if (text) {
            if (currentConversationId === null) startNewStory();
            addUserMessage(text);
            chatInput.value = '';
            micBtn.classList.remove('hidden');
            sendBtn.classList.add('hidden');
            callGeminiAPI(text).then(response => addBotMessage(response, false));
        }
    }

    recognition.onstart = () => console.log('Speech recognition started.');
    recognition.onresult = (event) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript + ' ';
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        chatInput.value = finalTranscript + interimTranscript;
    };
    
    recognition.onend = () => {
        console.log('Speech recognition ended.');
        if (isRecording && !isPaused) {
            console.log('Recognition timed out, restarting...');
            recognition.start();
            return;
        }
        micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        micBtn.classList.remove('animate-pulse');
        recordingControls.classList.add('hidden');
        if (finalTranscript.trim()) {
            addUserMessage(finalTranscript.trim());
            addBotMessage(finalTranscript.trim(), true);
        }
        chatInput.value = '';
        finalTranscript = '';
    };
    
    recognition.onerror = (event) => console.error('Speech recognition error:', event.error, event.message);

    // --- UI & Message Handling ---
    function addUserMessage(text) {
        const messageHTML = `<div class="flex justify-end mb-4"><div class="bg-blue-600 text-white rounded-lg p-3 max-w-lg">${text}</div></div>`;
        chatContainer.insertAdjacentHTML('beforeend', messageHTML);
        saveMessageToHistory('user', text);
        scrollToBottom();
    }

    function addBotMessage(text, withActions = false) {
        const messageId = `msg-${Date.now()}`;
        const actionsHTML = withActions ? `<div class="mt-2 flex items-center space-x-2"><button onclick="window.app.polishText('${messageId}', \`${text.replace(/`/g, '\\`')}\`)" class="flex items-center space-x-1 text-gray-400 hover:text-white text-sm"><i class="fas fa-wand-magic-sparkles"></i><span>Polish</span></button><button onclick="window.app.copyText('${messageId}')" class="flex items-center space-x-1 text-gray-400 hover:text-white text-sm"><i class="fas fa-copy"></i><span>Copy</span></button></div>` : '';
        const messageHTML = `<div class="flex justify-start mb-4"><div class="bg-[#2a2a2c] rounded-lg p-3 max-w-lg"><div id="${messageId}" class="whitespace-pre-wrap">${text}</div>${actionsHTML}</div></div>`;
        chatContainer.insertAdjacentHTML('beforeend', messageHTML);
        saveMessageToHistory('assistant', text);
        scrollToBottom();
    }
    
    window.app = {
        polishText: async (messageId, text) => {
            const button = event.target.closest('button');
            const originalContent = button.innerHTML;
            button.innerHTML = '<div class="loader"></div><span>Polishing...</span>';
            button.disabled = true;
            const polishLanguage = languageSelect.options[languageSelect.selectedIndex].text.split(' ')[0];
            const prompt = `Your task is to clean up a raw speech transcription in ${polishLanguage}. Please follow these rules:\n1. Correct any spelling mistakes and typos.\n2. Fix grammatical errors and ensure proper sentence structure and punctuation.\n3. Remove filler words (like "umm", "uh", "like", etc.) and unnecessary repetitions.\n4. **Crucially, preserve the original tone and speaking style.** Do not make the text more formal or change the vocabulary. The goal is to produce a clean, readable version of what was actually said.\n\nOriginal Text: "${text}"\n\nReturn ONLY the corrected ${polishLanguage} text.`;
            try {
                const polishedText = await callGeminiAPI(prompt);
                document.getElementById(messageId).innerText = polishedText;
                const conv = conversations.find(c => c.id === currentConversationId);
                if (conv) {
                    const msg = conv.messages.find(m => m.content === text);
                    if (msg) msg.content = polishedText;
                    saveConversations();
                }
            } catch (error) {
                console.error("Error polishing text:", error);
                alert("Failed to polish the text.");
            } finally {
                button.innerHTML = originalContent;
                button.disabled = false;
            }
        },
        copyText: (messageId) => {
            const textToCopy = document.getElementById(messageId).innerText;
            navigator.clipboard.writeText(textToCopy).then(() => {
                const button = event.target.closest('button');
                const span = button.querySelector('span');
                const originalText = span.innerText;
                span.innerText = 'Copied!';
                setTimeout(() => { span.innerText = originalText; }, 1500);
            }).catch(err => console.error('Failed to copy text: ', err));
        }
    };

    async function callGeminiAPI(prompt) {
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
        try {
            const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }]}) });
            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            const data = await response.json();
            return data.candidates[0].content.parts[0].text;
        } catch(error) {
            console.error("Gemini API call failed:", error);
            return "Error: Could not get a response from the API.";
        }
    }

    function scrollToBottom() {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // --- Conversation History Management ---
    function loadConversations() {
        const storedConvos = localStorage.getItem('voiceDiaryConversations');
        if (storedConvos) {
            conversations = JSON.parse(storedConvos);
            renderHistory();
            if (conversations.length > 0) loadConversation(conversations[0].id);
        }
    }

    function saveConversations() {
        localStorage.setItem('voiceDiaryConversations', JSON.stringify(conversations));
    }

    function startNewStory() {
        const newId = `conv-${Date.now()}`;
        const newConversation = { id: newId, title: 'New Story', messages: [], timestamp: Date.now() };
        conversations.unshift(newConversation);
        currentConversationId = newId;
        chatContainer.innerHTML = '';
        welcomeMessage.classList.remove('hidden');
        renderHistory();
        saveConversations();
        loadConversation(newId);
    }

    function renderHistory() {
        historyList.innerHTML = '';
        conversations.forEach(conv => {
            const item = document.createElement('button');
            item.className = `w-full text-left p-3 rounded-lg hover:bg-[#2a2a2c] text-sm truncate history-item ${conv.id === currentConversationId ? 'active' : ''}`;
            // --- MODIFICATION: Added delete icon ---
            item.innerHTML = `
                <div class="history-item-container">
                    <span class="truncate flex-1 mr-2">${conv.title}</span>
                    <i class="fas fa-edit edit-icon"></i>
                    <i class="fas fa-trash delete-icon"></i>
                </div>`;
            
            // --- MODIFICATION: Added event listeners for edit and delete ---
            item.querySelector('.edit-icon').addEventListener('click', (e) => {
                e.stopPropagation();
                editConversationTitle(conv.id, e.currentTarget.parentElement);
            });
            item.querySelector('.delete-icon').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteConversation(conv.id);
            });
            
            item.addEventListener('click', () => loadConversation(conv.id));
            historyList.appendChild(item);
        });
    }

    function editConversationTitle(convId, container) {
        const titleSpan = container.querySelector('span');
        const currentTitle = titleSpan.innerText;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentTitle;
        input.className = 'history-title-input';
        
        container.replaceChild(input, titleSpan);
        input.focus();

        const save = () => {
            const newTitle = input.value.trim() || 'Untitled';
            const conv = conversations.find(c => c.id === convId);
            if (conv) conv.title = newTitle;
            saveConversations();
            container.replaceChild(titleSpan, input);
            titleSpan.innerText = newTitle;
        };

        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
    }
    
    // --- MODIFICATION: New function to delete conversations ---
    function deleteConversation(convId) {
        if (!confirm('Are you sure you want to delete this story?')) return;

        const index = conversations.findIndex(c => c.id === convId);
        if (index > -1) {
            conversations.splice(index, 1);
            saveConversations();

            // If the deleted conversation was the active one, load a different one or start new
            if (convId === currentConversationId) {
                if (conversations.length > 0) {
                    // Load the first available conversation
                    loadConversation(conversations[0].id);
                } else {
                    // If no conversations left, start a new one
                    startNewStory();
                }
            }
            renderHistory();
        }
    }

    function loadConversation(id) {
        const conversation = conversations.find(c => c.id === id);
        if (!conversation) return;

        currentConversationId = id;
        chatContainer.innerHTML = '';
        welcomeMessage.classList.add('hidden');

        conversation.messages.forEach(msg => {
            if (msg.role === 'user') {
                 const messageHTML = `<div class="flex justify-end mb-4"><div class="bg-blue-600 text-white rounded-lg p-3 max-w-lg">${msg.content}</div></div>`;
                 chatContainer.insertAdjacentHTML('beforeend', messageHTML);
            } else {
                 addBotMessage(msg.content, true);
            }
        });
        
        if (conversation.messages.length === 0) welcomeMessage.classList.remove('hidden');

        scrollToBottom();
        renderHistory();
        if (window.innerWidth < 768) sidebar.classList.add('-translate-x-full');
    }

    function saveMessageToHistory(role, content) {
        const conv = conversations.find(c => c.id === currentConversationId);
        if (conv) {
            conv.messages.push({ role, content });
            if (conv.title === 'New Story' && role === 'user') {
                conv.title = content.substring(0, 30) + (content.length > 30 ? '...' : '');
                renderHistory();
            }
            saveConversations();
        }
    }
    
    // Initial Load
    loadConversations();
});
