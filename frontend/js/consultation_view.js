// frontend/js/consultation_view.js

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const consultationId = params.get('id');
    const container = document.getElementById('consultation-details-container');
    const uploadForm = document.getElementById('upload-form');
    const uploadStatus = document.getElementById('upload-status');
    const aiChatContainer = document.getElementById('ai-chat-container');
    const aiChatForm = document.getElementById('ai-chat-form');
    const aiQuestionInput = document.getElementById('ai-question-input');
    const chatWindow = document.getElementById('chat-window');
    const reportsListContainer = document.getElementById('reports-list-container');
    const noReportsMsg = document.getElementById('no-reports-msg');
    const scribeSection = document.getElementById('scribe-section');
    const recordBtn = document.getElementById('record-btn');
    const recordingStatus = document.getElementById('recording-status');
    const soapNoteDisplay = document.getElementById('soap-note-display');

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

    // Conditionally show AI features for doctors
    if (userRole === 'doctor') {
        aiChatContainer.classList.remove('hidden');
        aiChatContainer.classList.add('flex');
        scribeSection.classList.remove('hidden');
    }

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
        } catch (error) {
            container.innerHTML = `<p class="text-red-500">${error.message}</p>`;
        }
    }

    async function loadReports() {
        try {
            const response = await api.getReports(consultationId, token);
            if (!response.ok) throw new Error('Could not fetch reports.');
            const reports = await response.json();

            reportsListContainer.innerHTML = ''; // Clear previous list
            if (reports.length === 0) {
                reportsListContainer.appendChild(noReportsMsg);
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
                    fileDisplayHtml = `
                        <div class="flex items-start space-x-4">
                            <img src="${fileUrl}" alt="Report thumbnail" class="h-20 w-20 object-cover rounded-md border">
                            <p class="font-semibold text-gray-800 pt-1">${fileName}</p>
                        </div>`;
                } else {
                    fileDisplayHtml = `
                        <p class="font-semibold text-gray-800 flex items-center">
                            <i data-lucide="file-text" class="h-4 w-4 mr-2"></i>
                            ${fileName}
                        </p>`;
                }

                reportDiv.innerHTML = `
                    <div class="flex justify-between items-center">
                        ${fileDisplayHtml}
                        <a href="${fileUrl}" target="_blank" class="text-sm font-medium text-blue-600 hover:underline">View Full File</a>
                    </div>
                    <div class="mt-3 bg-gray-50 p-3 rounded-md">
                        <p class="text-xs font-semibold text-gray-600 mb-1">AI Summary:</p>
                        <p class="text-sm text-gray-700 whitespace-pre-wrap">${report.summary || 'Summary not available.'}</p>
                    </div>
                `;
                reportsListContainer.appendChild(reportDiv);
            });
            lucide.createIcons();
        } catch (error) {
            reportsListContainer.innerHTML = `<p class="text-red-500">${error.message}</p>`;
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
        }
    });

    recordBtn.addEventListener('click', () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
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
        messageDiv.className = 'flex';
        const bubble = document.createElement('p');
        bubble.className = 'chat-bubble';
        if (sender === 'user') {
            bubble.classList.add('chat-bubble-user');
        } else {
            bubble.classList.add('chat-bubble-assistant');
            if(isError) bubble.classList.add('!bg-red-100', '!text-red-700');
        }
        bubble.textContent = text;
        messageDiv.appendChild(bubble);
        chatWindow.appendChild(messageDiv);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    function addTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'typing-indicator';
        indicator.className = 'flex';
        indicator.innerHTML = `<p class="chat-bubble chat-bubble-assistant flex items-center space-x-1"><span class="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span><span class="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span><span class="h-2 w-2 bg-gray-400 rounded-full animate-bounce"></span></p>`;
        chatWindow.appendChild(indicator);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    function removeTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) indicator.remove();
    }

    // Initial data load
    loadConsultationDetails();
    loadReports();
});
