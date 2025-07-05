// frontend/js/consultation_view.js

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const consultationId = params.get('id');
    const container = document.getElementById('consultation-details-container');
    const uploadForm = document.getElementById('upload-form');
    const uploadStatus = document.getElementById('upload-status');
    const reportsListContainer = document.getElementById('reports-list-container');
    const noReportsMsg = document.getElementById('no-reports-msg');
    const scribeSection = document.getElementById('scribe-section');
    const recordBtn = document.getElementById('record-btn');
    const recordingStatus = document.getElementById('recording-status');
    const soapNoteDisplay = document.getElementById('soap-note-display');
    const ddxSection = document.getElementById('ddx-section');
    const generateDdxBtn = document.getElementById('generate-ddx-btn');
    const ddxStatus = document.getElementById('ddx-status');
    const ddxResultDisplay = document.getElementById('ddx-result-display');
    const patientHistorySection = document.getElementById('patient-history-section');
    const patientHistoryList = document.getElementById('patient-history-list');

    // Chat Widget Elements
    const aiChatWidget = document.getElementById('ai-chat-widget');
    const chatWidgetHeader = document.getElementById('chat-widget-header');
    const chatWidgetBody = document.getElementById('chat-widget-body');
    const aiChatForm = document.getElementById('ai-chat-form');
    const aiQuestionInput = document.getElementById('ai-question-input');
    const chatWindow = document.getElementById('chat-window');
    
    // Chat state management
    let isChatMinimized = false;
    let chatScrollPosition = 0;

    let mediaRecorder;
    let audioChunks = [];
    let isRecording = false;

    if (!consultationId) {
        container.innerHTML = `<p class="text-red-500">No consultation ID provided.</p>`;
        return;
    }

    const token = localStorage.getItem('accessToken');
    const userRole = localStorage.getItem('userRole');

    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    // Conditionally show doctor-only features
    if (userRole === 'doctor') {
        scribeSection.classList.remove('hidden');
        ddxSection.classList.remove('hidden');
        aiChatWidget.classList.remove('hidden');
    }

    // Enhanced Chat Widget Controls
    chatWidgetHeader.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (isChatMinimized) {
            // Restore chat
            chatWidgetBody.classList.remove('hidden');
            chatWidgetBody.style.transform = 'translateY(0)';
            chatWidgetBody.style.opacity = '1';
            isChatMinimized = false;
            
            // Restore scroll position
            setTimeout(() => {
                chatWindow.scrollTop = chatScrollPosition;
            }, 100);
        } else {
            // Minimize chat
            chatScrollPosition = chatWindow.scrollTop;
            chatWidgetBody.style.transform = 'translateY(100%)';
            chatWidgetBody.style.opacity = '0';
            setTimeout(() => {
                chatWidgetBody.classList.add('hidden');
            }, 300);
            isChatMinimized = true;
        }
        
        const icon = chatWidgetHeader.querySelector('i');
        icon.classList.toggle('rotate-180');
    });

    // Prevent chat window clicks from bubbling up to main page
    chatWindow.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Prevent chat form clicks from bubbling up
    aiChatForm.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    async function loadConsultationDetails() {
        try {
            const response = await api.getConsultations(token);
            if (!response.ok) throw new Error('Could not fetch consultation data.');

            const consultations = await response.json();
            const consultation = consultations.find(c => c.id == consultationId);

            if (!consultation) throw new Error('Consultation not found.');

            container.innerHTML = `
                <h2 class="text-2xl font-bold text-gray-900">Consultation #${consultation.id}</h2>
                <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700">
                    <div><span class="font-semibold">Patient:</span> ${consultation.patient.full_name}</div>
                    <div><span class="font-semibold">Doctor:</span> ${consultation.doctor.full_name}</div>
                    <div><span class="font-semibold">Scheduled:</span> ${new Date(consultation.scheduled_time).toLocaleString()}</div>
                    <div><span class="font-semibold">Status:</span> <span class="px-3 py-1 text-xs font-semibold text-blue-800 bg-blue-100 rounded-full">${consultation.status}</span></div>
                </div>
                <div class="mt-6">
                    <h4 class="font-semibold text-gray-800">Notes:</h4>
                    <p class="mt-1 text-gray-600 whitespace-pre-wrap">${consultation.notes || 'No notes provided.'}</p>
                </div>
            `;
            if (consultation.soap_note) {
                soapNoteDisplay.value = consultation.soap_note;
            }
            if (consultation.ddx_result) {
                ddxResultDisplay.textContent = consultation.ddx_result;
            }

            if (userRole === 'doctor') {
                loadPatientHistory(consultation.patient.id);
            }
        } catch (error) {
            container.innerHTML = `<p class="text-red-500">${error.message}</p>`;
        }
    }

    async function loadReports() {
        try {
            const response = await api.getReports(consultationId, token);
            if (!response.ok) throw new Error('Could not fetch reports.');
            const reports = await response.json();

            reportsListContainer.innerHTML = '';
            if (reports.length === 0) {
                reportsListContainer.innerHTML = `<p id="no-reports-msg" class="text-gray-500">No reports have been uploaded for this consultation yet.</p>`;
                return;
            }

            const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
            reports.forEach(report => {
                const reportDiv = document.createElement('div');
                reportDiv.className = 'p-4 border rounded-lg';
                const fileName = report.file_path.split('/').pop();
                const fileExt = '.' + fileName.split('.').pop().toLowerCase();
                const isImage = imageExtensions.includes(fileExt);
                const fileUrl = `${API_BASE_URL.replace('/api/v1', '')}/${report.file_path}`;

                let fileDisplayHtml = '';
                if (isImage) {
                    fileDisplayHtml = `<div class="flex items-start space-x-4"><img src="${fileUrl}" alt="Report thumbnail" class="h-20 w-20 object-cover rounded-md border"><p class="font-semibold text-gray-800 pt-1">${fileName}</p></div>`;
                } else {
                    fileDisplayHtml = `<p class="font-semibold text-gray-800 flex items-center"><i data-lucide="file-text" class="h-4 w-4 mr-2"></i>${fileName}</p>`;
                }

                reportDiv.innerHTML = `
                    <div class="flex justify-between items-center">${fileDisplayHtml}<a href="${fileUrl}" target="_blank" class="text-sm font-medium text-blue-600 hover:underline">View Full File</a></div>
                    <div class="mt-3 bg-gray-50 p-3 rounded-md"><p class="text-xs font-semibold text-gray-600 mb-1">AI Summary:</p><p class="text-sm text-gray-700 whitespace-pre-wrap">${report.summary || 'Summary not available.'}</p></div>
                `;
                reportsListContainer.appendChild(reportDiv);
            });
            lucide.createIcons();
        } catch (error) {
            reportsListContainer.innerHTML = `<p class="text-red-500">${error.message}</p>`;
        }
    }

    async function loadPatientHistory(patientId) {
        try {
            const response = await api.getPatientHistory(patientId, token);
            if (!response.ok) throw new Error('Could not fetch patient history.');

            const history = await response.json();
            const pastConsultations = history.filter(h => h.id != consultationId);

            if (pastConsultations.length === 0) {
                patientHistoryList.innerHTML = `<p class="text-sm text-gray-500">No previous consultations found with this patient.</p>`;
                return;
            }

            patientHistoryList.innerHTML = '';
            pastConsultations.forEach(item => {
                const historyDiv = document.createElement('div');
                historyDiv.className = 'p-3 border rounded-lg bg-gray-50';
                historyDiv.innerHTML = `
                    <div class="flex justify-between items-center">
                        <p class="font-semibold text-gray-800">Consultation #${item.id}</p>
                        <span class="text-sm text-gray-500">${new Date(item.scheduled_time).toLocaleDateString()}</span>
                    </div>
                    <div class="mt-2 text-sm text-gray-600">
                        <p class="font-semibold">Outcome Summary (DDx):</p>
                        <p class="truncate">${item.ddx_result || 'No diagnosis summary available.'}</p>
                    </div>
                    <a href="consultation.html?id=${item.id}" target="_blank" class="text-sm font-medium text-blue-600 hover:underline mt-2 inline-block">View Full Details &rarr;</a>
                `;
                patientHistoryList.appendChild(historyDiv);
            });
        } catch (error) {
            patientHistoryList.innerHTML = `<p class="text-red-500">${error.message}</p>`;
        }
    }

    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        uploadStatus.textContent = 'Uploading and processing file... This may take a moment.';
        uploadStatus.className = 'text-blue-600';
        const file = e.target['report-file'].files[0];
        if (!file) return;
        try {
            const response = await api.uploadReport(consultationId, file, token);
            if (!response.ok) throw new Error('Upload failed.');
            await response.json();
            uploadStatus.textContent = `Successfully uploaded and processed ${file.name}!`;
            uploadStatus.className = 'text-green-600';
            uploadForm.reset();
            loadReports();
        } catch (error) {
            uploadStatus.textContent = error.message;
            uploadStatus.className = 'text-red-600';
        }
    });

    aiChatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const question = aiQuestionInput.value.trim();
        if (!question) return;

        // Disable input and show loading state
        aiQuestionInput.disabled = true;
        const submitBtn = aiChatForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i data-lucide="loader-2" class="h-4 w-4 animate-spin"></i> Sending...';
        submitBtn.disabled = true;
        lucide.createIcons();

        addMessageToChat(question, 'user');
        aiQuestionInput.value = '';
        addTypingIndicator();

        try {
            const response = await api.askAI(consultationId, question, token);
            removeTypingIndicator();
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'Failed to get answer from AI.');
            }
            const data = await response.json();
            addMessageToChat(data.answer, 'assistant');
        } catch (error) {
            removeTypingIndicator();
            addMessageToChat(error.message, 'assistant', true);
        } finally {
            // Re-enable input and restore button
            aiQuestionInput.disabled = false;
            submitBtn.innerHTML = originalBtnText;
            submitBtn.disabled = false;
            aiQuestionInput.focus();
        }
    });

    // Add keyboard shortcuts
    aiQuestionInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            aiChatForm.dispatchEvent(new Event('submit'));
        }
    });

    // Auto-resize input field
    aiQuestionInput.addEventListener('input', () => {
        aiQuestionInput.style.height = 'auto';
        aiQuestionInput.style.height = Math.min(aiQuestionInput.scrollHeight, 120) + 'px';
    });

    recordBtn.addEventListener('click', () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    });

    generateDdxBtn.addEventListener('click', async () => {
        ddxStatus.textContent = 'Generating DDx... This may take a few moments.';
        ddxStatus.className = 'text-blue-600';
        generateDdxBtn.disabled = true;
        try {
            const response = await api.generateDdx(consultationId, token);
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Failed to generate DDx.');
            }
            const data = await response.json();
            ddxResultDisplay.textContent = data.ddx_result;
            ddxStatus.textContent = 'DDx report generated successfully!';
            ddxStatus.className = 'text-green-600';
        } catch (error) {
            ddxStatus.textContent = `Error: ${error.message}`;
            ddxStatus.className = 'text-red-600';
        } finally {
            generateDdxBtn.disabled = false;
        }
    });

    async function startRecording() {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                isRecording = true;
                recordBtn.innerHTML = `<i data-lucide="stop-circle" class="h-5 w-5"></i><span>Stop Recording</span>`;
                lucide.createIcons();
                recordingStatus.textContent = 'Recording...';
                mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
                audioChunks = [];
                mediaRecorder.ondataavailable = event => {
                    audioChunks.push(event.data);
                };
                mediaRecorder.onstop = processAudio;
                mediaRecorder.start();
            })
            .catch(err => {
                recordingStatus.textContent = 'Could not start recording. Please allow microphone access.';
                console.error("Error getting user media:", err);
            });
    }

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            isRecording = false;
            recordBtn.innerHTML = `<i data-lucide="mic" class="h-5 w-5"></i><span>Start Recording</span>`;
            lucide.createIcons();
            recordingStatus.textContent = 'Recording stopped. Preparing to process...';
        }
    }

    async function processAudio() {
        if (audioChunks.length === 0) {
            recordingStatus.textContent = 'No audio was recorded.';
            return;
        }
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        recordingStatus.textContent = 'Processing audio...';
        try {
            const response = await api.createNoteFromAudio(consultationId, audioBlob, token);
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Failed to process audio.');
            }
            const data = await response.json();
            soapNoteDisplay.value = data.soap_note;
            recordingStatus.textContent = 'SOAP note generated successfully!';
        } catch (error) {
            recordingStatus.textContent = `Error: ${error.message}`;
        }
    }

    function addMessageToChat(text, sender, isError = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'flex mb-4 animate-fade-in';
        
        const bubble = document.createElement('div');
        bubble.className = 'max-w-[80%] rounded-2xl px-4 py-3 shadow-sm';
        
        if (sender === 'user') {
            messageDiv.classList.add('justify-end');
            bubble.classList.add('bg-blue-500', 'text-white', 'ml-4');
            bubble.innerHTML = formatMessageContent(text);
        } else {
            messageDiv.classList.add('justify-start');
            if (isError) {
                bubble.classList.add('bg-red-100', 'text-red-700', 'border', 'border-red-200');
            } else {
                bubble.classList.add('bg-gray-100', 'text-gray-800', 'mr-4');
            }
            bubble.innerHTML = formatMessageContent(text);
        }
        
        // Add timestamp
        const timestamp = document.createElement('div');
        timestamp.className = 'message-timestamp text-center mt-1';
        timestamp.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        messageDiv.appendChild(bubble);
        messageDiv.appendChild(timestamp);
        
        chatWindow.appendChild(messageDiv);
        
        // Smooth scroll to bottom
        smoothScrollToBottom();
    }
    
    function formatMessageContent(text) {
        // Convert URLs to clickable links
        text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-blue-600 underline">$1</a>');
        
        // Format lists
        text = text.replace(/^(\d+\.|\*|\-)\s+(.+)$/gm, '<li class="ml-4">$2</li>');
        if (text.includes('<li')) {
            text = text.replace(/^(.+)$/gm, '<ul class="list-disc space-y-1">$1</ul>');
        }
        
        // Format code blocks
        text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="bg-gray-800 text-green-400 p-3 rounded-md overflow-x-auto my-2"><code>$2</code></pre>');
        
        // Format inline code
        text = text.replace(/`([^`]+)`/g, '<code class="bg-gray-200 px-1 py-0.5 rounded text-sm">$1</code>');
        
        // Format bold text
        text = text.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>');
        
        // Format italic text
        text = text.replace(/\*(.+?)\*/g, '<em class="italic">$1</em>');
        
        // Convert line breaks to <br> tags
        text = text.replace(/\n/g, '<br>');
        
        return text;
    }
    
    function smoothScrollToBottom() {
        if (!chatWindow) return;
        
        const scrollHeight = chatWindow.scrollHeight;
        const clientHeight = chatWindow.clientHeight;
        const maxScrollTop = scrollHeight - clientHeight;
        
        // If already at bottom, don't animate
        if (chatWindow.scrollTop >= maxScrollTop - 10) {
            chatWindow.scrollTop = maxScrollTop;
            return;
        }
        
        // Smooth scroll animation
        const startScrollTop = chatWindow.scrollTop;
        const distance = maxScrollTop - startScrollTop;
        const duration = 300;
        const startTime = performance.now();
        
        function animateScroll(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function for smooth animation
            const easeOutCubic = 1 - Math.pow(1 - progress, 3);
            
            chatWindow.scrollTop = startScrollTop + (distance * easeOutCubic);
            
            if (progress < 1) {
                requestAnimationFrame(animateScroll);
            }
        }
        
        requestAnimationFrame(animateScroll);
    }

    function addTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'typing-indicator';
        indicator.className = 'flex justify-start mb-4 animate-fade-in';
        indicator.innerHTML = `
            <div class="max-w-[80%] rounded-2xl px-4 py-3 shadow-sm bg-gray-100 text-gray-800 mr-4">
                <div class="flex items-center space-x-3">
                    <div class="typing-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                    <span class="text-sm text-gray-500 font-medium">AI is analyzing...</span>
                </div>
            </div>
        `;
        chatWindow.appendChild(indicator);
        smoothScrollToBottom();
    }

    function removeTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.style.opacity = '0';
            indicator.style.transform = 'translateY(-10px)';
            setTimeout(() => {
                indicator.remove();
            }, 200);
        }
    }

    // Initialize chat window
    function initializeChatWindow() {
        // Ensure chat window is properly scrollable
        if (chatWindow) {
            chatWindow.style.overflowY = 'auto';
            chatWindow.style.overflowX = 'hidden';
            
            // Add scroll event listener to prevent bubbling
            chatWindow.addEventListener('scroll', (e) => {
                e.stopPropagation();
            });
            
            // Add wheel event listener to prevent main page scroll when scrolling chat
            chatWindow.addEventListener('wheel', (e) => {
                e.stopPropagation();
            });
        }
    }

    // Initial data load
    loadConsultationDetails();
    loadReports();
    initializeChatWindow();
});
