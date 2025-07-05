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

    // Toggle Chat Widget Body
    chatWidgetHeader.addEventListener('click', () => {
        chatWidgetBody.classList.toggle('hidden');
        const icon = chatWidgetHeader.querySelector('i');
        icon.classList.toggle('rotate-180');
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
