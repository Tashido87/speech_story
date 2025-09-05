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
    const mainContentOverlay = document.getElementById('main-content-overlay');


    // Speech Recognition Setup
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;
    let isRecording = false;
    let isPaused = false;

    // iOS Device Check
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    if (isIOS) {
        alert("Please note: Due to limitations on iOS, the voice transcription feature is not available. You can still type your entries manually.");
        micBtn.disabled = true;
        micBtn.style.backgroundColor = '#555'; // Gray out the button
    } else if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'my-MM'; // Default to Burmese
    } else {
        alert("Sorry, your browser doesn't support the Speech Recognition API. Please try Chrome or Edge.");
        micBtn.disabled = true;
        micBtn.style.backgroundColor = '#555';
    }


    // App State
    let conversations = [];
    let currentConversationId = null;
    let finalTranscript = '';

    // --- Event Listeners ---

    menuToggle.addEventListener('click', toggleSidebar);
    if (!isIOS) {
        micBtn.addEventListener('click', toggleRecording);
        stopBtn.addEventListener('click', stopRecording);
        pauseResumeBtn.addEventListener('click', togglePause);
    }
    sendBtn.addEventListener('click', handleTextInput);
    newStoryBtn.addEventListener('click', startNewStory);
    mainContentOverlay.addEventListener('click', closeSidebar);


    chatInput.addEventListener('input', () => {
        if (chatInput.value.trim() !== '') {
            micBtn.classList.add('hidden');
            sendBtn.classList.remove('hidden');
        } else {
            micBtn.classList.remove('hidden');
            sendBtn.classList.add('hidden');
        }
    });

    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleTextInput();
        }
    });

    // --- Sidebar Swipe Gestures ---
    let touchStartX = 0;
    let touchEndX = 0;

    document.body.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    document.body.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipeGesture();
    }, { passive: true });

    function handleSwipeGesture() {
        // Swipe Left to close
        if (touchStartX - touchEndX > 50 && !sidebar.classList.contains('-translate-x-full')) {
            closeSidebar();
        }
        // Swipe Right to open
        if (touchEndX - touchStartX > 50 && sidebar.classList.contains('-translate-x-full')) {
            openSidebar();
        }
    }


    function toggleSidebar() {
        if (sidebar.classList.contains('-translate-x-full')) {
            openSidebar();
        } else {
            closeSidebar();
        }
    }

    function openSidebar() {
        sidebar.classList.remove('-translate-x-full');
        mainContentOverlay.classList.remove('hidden');
    }

    function closeSidebar() {
        sidebar.classList.add('-translate-x-full');
        mainContentOverlay.classList.add('hidden');
    }


    // --- Core Functions ---

    function toggleRecording() {
        if (!SpeechRecognition) return;
        if (isRecording && !isPaused) { // If recording, the main button acts as a stop button
            stopRecording();
        } else {
            startRecording();
        }
    }

    function startRecording() {
        if (currentConversationId === null) startNewStory();

        welcomeMessage.classList.add('hidden');
        isRecording = true;
        isPaused = false;

        // Only clear transcript if it's a fresh start, not a resume
        if (!isPaused) {
            finalTranscript = '';
        }

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
            // For text input, we don't need to polish, just get a response
            // callGeminiAPI(text).then(response => addBotMessage(response, false));
        }
    }

    if (recognition) {
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
            // Only process the transcript if we are not in a paused state
            if (!isPaused) {
                isRecording = false;
                micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
                micBtn.classList.remove('animate-pulse');
                recordingControls.classList.add('hidden');

                if (finalTranscript.trim()) {
                    const transcribedText = finalTranscript.trim();
                    addUserMessage(transcribedText);
                    // Automatically polish the transcribed speech
                    window.app.polishText(`msg-user-${Date.now()}`, transcribedText, true);
                }
                chatInput.value = '';
                finalTranscript = ''; // Clear for next recording
            }
        };
        recognition.onerror = (event) => console.error('Speech recognition error:', event.error);
    }


    // --- UI & Message Handling ---

    function addUserMessage(text) {
        const messageHTML = `<div class="flex justify-end mb-4"><div class="bg-blue-600 text-white rounded-lg p-3 max-w-lg">${text}</div></div>`;
        chatContainer.insertAdjacentHTML('beforeend', messageHTML);
        saveMessageToHistory('user', text);
        scrollToBottom();
    }

    function addBotMessage(text, withActions = false) {
        const messageId = `msg-${Date.now()}`;
        const actionsHTML = withActions ? `
            <div class="mt-2 flex items-center space-x-2">
                <button onclick="window.app.polishText('${messageId}', \`${text.replace(/`/g, '\\`')}\`)" class="flex items-center space-x-1 text-gray-400 hover:text-white text-sm"><i class="fas fa-wand-magic-sparkles"></i><span>Polish</span></button>
                <button onclick="window.app.copyText('${messageId}')" class="flex items-center space-x-1 text-gray-400 hover:text-white text-sm"><i class="fas fa-copy"></i><span>Copy</span></button>
            </div>` : '';

        const messageHTML = `
            <div class="flex justify-start mb-4">
                <div class="bg-[#2a2a2c] rounded-lg p-3 max-w-lg">
                    <div id="${messageId}" class="whitespace-pre-wrap">${text}</div>
                    ${actionsHTML}
                </div>
            </div>`;
        chatContainer.insertAdjacentHTML('beforeend', messageHTML);
        saveMessageToHistory('assistant', text);
        scrollToBottom();
    }

   window.app = {
    polishText: async (messageId, text, isNewTranscription = false) => {
        let button, originalContent;
        if (!isNewTranscription) {
            button = event.target.closest('button');
            originalContent = button.innerHTML;
            button.innerHTML = '<div class="loader"></div><span>Polishing...</span>';
            button.disabled = true;
        }

        // --- ENHANCED PROMPT ---
        const prompt = `
        You are an expert transcription assistant. Your task is to refine a raw, voice-to-text transcription from Burmese.
        Follow these rules precisely:
        1.  **Correct Mistakes**: Fix spelling errors, grammatical mistakes, and add appropriate punctuation (commas, periods, question marks, etc.). Structure the text into logical sentences and paragraphs.
        2.  **Handle Mixed Language**: The transcription is primarily in Burmese, but it may contain English words or phrases. Transcribe the English words using the English alphabet. DO NOT translate them into Burmese.
        3.  **Preserve Speaking Style**: This is the most important rule. Do NOT change the user's natural way of speaking.
            -   **Keep Colloquialisms**: Retain conversational phrases like "...ဖြစ်ပါတယ်ပေါ့နော်". Do NOT change it to a formal version like "...ဖြစ်ပါသည်".
            -   **No Formalizing**: Do not replace simple words with more formal or complex vocabulary. The goal is a clean, readable version of what was *actually said*, not a formal essay.
            -   **Remove only Fillers**: You should only remove meaningless filler words (like "umm", "uh") and false starts or unnecessary repetitions.

        **Example:**
        -   **Original:** "uhm yesterday I go to the supermarket and then yani I bought some apples"
        -   **Correct Output:** "Yesterday I go to the supermarket and then, yani, I bought some apples."

        **Original Text to Polish:**
        "${text}"

        Return ONLY the corrected Burmese text.
        `;

        try {
            const polishedText = await callGeminiAPI(prompt);
            if (isNewTranscription) {
                addBotMessage(polishedText, true); // Add as a new bot message
            } else {
                document.getElementById(messageId).innerText = polishedText; // Update existing message
                // Update the message in the conversation history
                 const conv = conversations.find(c => c.id === currentConversationId);
                if (conv) {
                    const msg = conv.messages.find(m => m.content === text && m.role === 'assistant');
                    if (msg) {
                        msg.content = polishedText;
                        saveConversations();
                    }
                }
            }
        } catch (error) {
            console.error("Error polishing text:", error);
            if (isNewTranscription) {
                 addBotMessage("Sorry, I couldn't polish the text.", false);
            } else {
                 alert("Failed to polish the text.");
            }
        } finally {
            if (!isNewTranscription) {
                button.innerHTML = originalContent;
                button.disabled = false;
            }
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
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;
        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.5, topK: 1, topP: 1, maxOutputTokens: 2048 }
        };

        try {
            const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
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
            if (conversations.length > 0) {
                 loadConversation(conversations[0].id)
            } else {
                 startNewStory();
            };
        } else {
            startNewStory();
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
        highlightActiveConversation();
        saveConversations();
    }

    function renderHistory() {
        historyList.innerHTML = '';
        conversations.sort((a, b) => b.timestamp - a.timestamp).forEach(conv => {
            const item = document.createElement('button');
            item.className = `w-full text-left p-3 rounded-lg hover:bg-[#2a2a2c] text-sm truncate history-item`;
            item.dataset.id = conv.id; // Store id in data attribute
            item.innerHTML = `
                <div class="history-item-container">
                    <span class="truncate flex-1 mr-2">${conv.title}</span>
                    <i class="fas fa-edit edit-icon"></i>
                </div>`;

            item.querySelector('.fa-edit').addEventListener('click', (e) => {
                e.stopPropagation();
                editConversationTitle(conv.id, e.currentTarget.parentElement);
            });
            item.addEventListener('click', () => loadConversation(conv.id));
            historyList.appendChild(item);
        });
        highlightActiveConversation();
    }

    function highlightActiveConversation() {
        document.querySelectorAll('.history-item').forEach(item => {
            if(item.dataset.id === currentConversationId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
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
            if (conv) {
                conv.title = newTitle;
                saveConversations();
            }
            container.replaceChild(titleSpan, input);
            titleSpan.innerText = newTitle;
        };

        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
    }

    function loadConversation(id) {
        const conversation = conversations.find(c => c.id === id);
        if (!conversation) return;

        currentConversationId = id;
        chatContainer.innerHTML = '';
        welcomeMessage.classList.add('hidden');

        let messageAdded = false;
        conversation.messages.forEach(msg => {
            messageAdded = true;
            // The logic was recreating messages, but now we have a polished version,
            // let's ensure we display the right thing.
            // For simplicity, we'll re-add them. In a more complex app, you might differentiate.
            if (msg.role === 'user') {
                 addUserMessage(msg.content);
            } else { // 'assistant'
                 addBotMessage(msg.content, true); // Always show actions on load
            }
        });

        if (!messageAdded) {
            welcomeMessage.classList.remove('hidden');
        }

        scrollToBottom();
        highlightActiveConversation();
        if (window.innerWidth < 768) {
             closeSidebar();
        }
    }

    function saveMessageToHistory(role, content) {
        const conv = conversations.find(c => c.id === currentConversationId);
        if (conv) {
             // Avoid duplicating user message if it's just a transcription
            const lastMessage = conv.messages[conv.messages.length - 1];
            if (lastMessage && lastMessage.role === role && lastMessage.content === content) {
                return;
            }

            conv.messages.push({ role, content });
            // Update title only for the first user message
            if (conv.title === 'New Story' && role === 'user' && conv.messages.filter(m => m.role === 'user').length === 1) {
                conv.title = content.substring(0, 30) + (content.length > 30 ? '...' : '');
                renderHistory();
            }
             conv.timestamp = Date.now(); // Update timestamp on new message
            saveConversations();
        }
    }

    // Initial Load
    loadConversations();
});
