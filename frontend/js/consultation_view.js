// Modern Consultation View JavaScript - MedFlow Platform

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const consultationDetailsContainer = document.getElementById('consultation-details-container');
    const ddxSection = document.getElementById('ddx-section');
    const scribeSection = document.getElementById('scribe-section');
    const patientHistorySection = document.getElementById('patient-history-section');
    const generateDdxBtn = document.getElementById('generate-ddx-btn');
    const ddxStatus = document.getElementById('ddx-status');
    const ddxResultDisplay = document.getElementById('ddx-result-display');
    const recordBtn = document.getElementById('record-btn');
    const recordingStatus = document.getElementById('recording-status');
    const soapNoteDisplay = document.getElementById('soap-note-display');
    const patientHistoryList = document.getElementById('patient-history-list');
    const uploadForm = document.getElementById('upload-form');
    const reportFile = document.getElementById('report-file');
    const uploadStatus = document.getElementById('upload-status');
    const reportsListContainer = document.getElementById('reports-list-container');
    const aiChatWidget = document.getElementById('ai-chat-widget');
    const chatWidgetHeader = document.getElementById('chat-widget-header');
    const chatWidgetBody = document.getElementById('chat-widget-body');
    const chatWindow = document.getElementById('chat-window');
    const aiChatForm = document.getElementById('ai-chat-form');
    const aiQuestionInput = document.getElementById('ai-question-input');

    // State Management
    let currentConsultation = null;
    let isRecording = false;
    let mediaRecorder = null;
    let recordedChunks = [];
    let uploadedReports = [];
    let isChatMinimized = false;
    let chatScrollPosition = 0;

    // Initialize
    function initialize() {
        console.log('Initializing consultation view...');
        
        // Debug: Check MediaRecorder support
        console.log('MediaRecorder supported:', !!window.MediaRecorder);
        if (window.MediaRecorder) {
            const testTypes = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/mp4',
                'audio/ogg;codecs=opus',
                'audio/wav'
            ];
            console.log('Supported MIME types:');
            testTypes.forEach(type => {
                console.log(`${type}: ${MediaRecorder.isTypeSupported(type)}`);
            });
        }
        
        const urlParams = new URLSearchParams(window.location.search);
        const consultationId = urlParams.get('id');
        
        if (consultationId) {
            loadConsultationDetails(consultationId);
        } else {
            showError('No consultation ID provided');
        }

        setupEventListeners();
        setupChatWidget();
        
        // Debug: Ensure chat widget is visible for testing
        console.log('Initializing chat widget...');
        if (aiChatWidget) {
            aiChatWidget.classList.remove('hidden');
            console.log('Chat widget made visible');
        }
    }

    // Setup Event Listeners
    function setupEventListeners() {
        generateDdxBtn?.addEventListener('click', generateDifferentialDiagnosis);
        recordBtn?.addEventListener('click', toggleRecording);
        uploadForm?.addEventListener('submit', handleFileUpload);
        aiChatForm?.addEventListener('submit', handleAiChat);
        
        // Chat widget toggle
        chatWidgetHeader?.addEventListener('click', toggleChatWidget);
        
        // File upload drag and drop
        setupDragAndDrop();
        
        // Floating Action Button
        setupFloatingActionButton();
        
        // Report Analysis
        const analyzeReportsBtn = document.getElementById('analyze-reports-btn');
        analyzeReportsBtn?.addEventListener('click', analyzeReports);
        
        // Scribe Controls
        const clearNoteBtn = document.getElementById('clear-note-btn');
        const saveNoteBtn = document.getElementById('save-note-btn');
        
        clearNoteBtn?.addEventListener('click', clearSoapNote);
        saveNoteBtn?.addEventListener('click', saveSoapNote);
    }

    // Setup Floating Action Button
    function setupFloatingActionButton() {
        const mainFab = document.getElementById('main-fab');
        const quickActionsMenu = document.getElementById('quick-actions-menu');
        const quickDdxBtn = document.getElementById('quick-ddx-btn');
        const quickRecordBtn = document.getElementById('quick-record-btn');
        const quickUploadBtn = document.getElementById('quick-upload-btn');
        const quickAnalyzeBtn = document.getElementById('quick-analyze-btn');

        // Toggle quick actions menu
        mainFab?.addEventListener('click', () => {
            const isVisible = !quickActionsMenu.classList.contains('hidden');
            if (isVisible) {
                quickActionsMenu.classList.add('hidden');
                mainFab.querySelector('i').setAttribute('data-lucide', 'plus');
            } else {
                quickActionsMenu.classList.remove('hidden');
                mainFab.querySelector('i').setAttribute('data-lucide', 'x');
            }
            lucide.createIcons();
        });

        // Quick action buttons
        quickDdxBtn?.addEventListener('click', () => {
            generateDifferentialDiagnosis();
            quickActionsMenu.classList.add('hidden');
            mainFab.querySelector('i').setAttribute('data-lucide', 'plus');
            lucide.createIcons();
        });

        quickRecordBtn?.addEventListener('click', () => {
            toggleRecording();
            quickActionsMenu.classList.add('hidden');
            mainFab.querySelector('i').setAttribute('data-lucide', 'plus');
            lucide.createIcons();
        });

        quickUploadBtn?.addEventListener('click', () => {
            // Scroll to upload section and trigger file input
            const uploadSection = document.querySelector('#upload-form');
            uploadSection?.scrollIntoView({ behavior: 'smooth' });
            reportFile?.click();
            quickActionsMenu.classList.add('hidden');
            mainFab.querySelector('i').setAttribute('data-lucide', 'plus');
            lucide.createIcons();
        });

        quickAnalyzeBtn?.addEventListener('click', () => {
            // Scroll to analysis section and trigger analysis
            const analysisSection = document.querySelector('#report-analysis-section');
            analysisSection?.scrollIntoView({ behavior: 'smooth' });
            analyzeReports();
            quickActionsMenu.classList.add('hidden');
            mainFab.querySelector('i').setAttribute('data-lucide', 'plus');
            lucide.createIcons();
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!mainFab?.contains(e.target) && !quickActionsMenu?.contains(e.target)) {
                quickActionsMenu?.classList.add('hidden');
                mainFab?.querySelector('i')?.setAttribute('data-lucide', 'plus');
                lucide.createIcons();
            }
        });
    }

    // Load Consultation Details
    async function loadConsultationDetails(consultationId) {
        try {
            console.log('Loading consultation details for ID:', consultationId);
            console.log('API object:', api);
            console.log('getConsultation function:', api.getConsultation);
            
            const token = localStorage.getItem('accessToken');
            if (!token) {
                window.location.href = 'index.html';
                return;
            }

            // First try to get the specific consultation
            if (!api.getConsultation) {
                console.error('getConsultation function not found in API');
                throw new Error('API function getConsultation not available');
            }
            
            let response = await api.getConsultation(consultationId, token);
            
            if (!response.ok) {
                // If specific consultation not found, try to get from consultations list
                response = await api.getConsultations(token);
                if (!response.ok) throw new Error('Failed to load consultation data');
                
                const consultations = await response.json();
                currentConsultation = consultations.find(c => c.id == consultationId);
                
                if (!currentConsultation) {
                    throw new Error('Consultation not found');
                }
            } else {
                currentConsultation = await response.json();
            }
            
            renderConsultationDetails();
            
            // Show appropriate sections based on user role
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (user.role === 'doctor') {
                ddxSection?.classList.remove('hidden');
                scribeSection?.classList.remove('hidden');
                patientHistorySection?.classList.remove('hidden');
                // Show chat widget for doctors
                aiChatWidget?.classList.remove('hidden');
            } else {
                // For patients, show chat widget if they have reports
                aiChatWidget?.classList.remove('hidden');
            }
            
            // Load reports
            loadReports();
            
            // Load patient history if user is doctor
            if (user.role === 'doctor' && currentConsultation?.patient?.id) {
                loadPatientHistory(currentConsultation.patient.id);
            }
            
            // Load saved DDx if it exists
            if (currentConsultation.ddx_result) {
                displaySavedDdx(currentConsultation.ddx_result);
            }
            
            // Load saved SOAP note if it exists
            if (currentConsultation.soap_note) {
                displaySavedSoapNote(currentConsultation.soap_note);
            }
            
        } catch (error) {
            console.error('Error loading consultation:', error);
            showError('Failed to load consultation details: ' + error.message);
        }
    }

    // Render Consultation Details
    function renderConsultationDetails() {
        if (!currentConsultation || !consultationDetailsContainer) return;

        const { patient, doctor, scheduled_time, status, notes } = currentConsultation;
        const statusOptions = [
            { value: 'scheduled', label: 'Scheduled' },
            { value: 'completed', label: 'Completed' },
            { value: 'cancelled', label: 'Cancelled' }
        ];
        const statusLabel = status ? status.charAt(0).toUpperCase() + status.slice(1) : '';
        const canChangeStatus = status === 'scheduled' || status === 'completed';
        
        consultationDetailsContainer.innerHTML = `
            <div class="flex items-start justify-between mb-6">
                <div class="flex items-center space-x-4">
                    <div class="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center">
                        <i data-lucide="user" class="h-8 w-8 text-white"></i>
                    </div>
                    <div>
                        <h2 class="text-2xl font-bold text-gray-900">Consultation #${currentConsultation.id}</h2>
                        <p class="text-gray-600">${patient.full_name} with Dr. ${doctor.full_name}</p>
                    </div>
                </div>
                <div class="flex items-center space-x-3">
                    <span class="status-badge status-${status}">${statusLabel}</span>
                    <button class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <i data-lucide="more-vertical" class="h-5 w-5"></i>
                    </button>
                    ${canChangeStatus ? `
                    <select id="status-action-select" class="ml-2 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Change Status...</option>
                        ${statusOptions.filter(opt => opt.value !== status).map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('')}
                    </select>
                    ` : ''}
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="space-y-2">
                    <h3 class="text-sm font-medium text-gray-500">Patient</h3>
                    <p class="text-lg font-semibold text-gray-900">${patient.full_name}</p>
                    <p class="text-sm text-gray-600">${patient.email}</p>
                </div>
                <div class="space-y-2">
                    <h3 class="text-sm font-medium text-gray-500">Doctor</h3>
                    <p class="text-lg font-semibold text-gray-900">Dr. ${doctor.full_name}</p>
                    <p class="text-sm text-gray-600">${doctor.email}</p>
                </div>
                <div class="space-y-2">
                    <h3 class="text-sm font-medium text-gray-500">Scheduled</h3>
                    <p class="text-lg font-semibold text-gray-900">${new Date(scheduled_time).toLocaleDateString()}</p>
                    <p class="text-sm text-gray-600">${new Date(scheduled_time).toLocaleTimeString()}</p>
                </div>
            </div>
            ${notes ? `
                <div class="mt-6 p-4 bg-gray-50 rounded-xl">
                    <h3 class="text-sm font-medium text-gray-700 mb-2">Notes</h3>
                    <p class="text-gray-900">${notes}</p>
                </div>
            ` : ''}
        `;

        // Add event listener for status change
        const statusSelect = document.getElementById('status-action-select');
        if (statusSelect) {
            statusSelect.addEventListener('change', async (e) => {
                const newStatus = e.target.value;
                if (!newStatus) return;
                statusSelect.disabled = true;
                try {
                    const token = localStorage.getItem('accessToken');
                    const response = await api.updateConsultationStatus(currentConsultation.id, newStatus, token);
                    if (!response.ok) throw new Error('Failed to update status');
                    showNotification('Consultation status updated!', 'success');
                    // Refresh details
                    await loadConsultationDetails(currentConsultation.id);
                } catch (err) {
                    showNotification('Failed to update status', 'error');
                } finally {
                    statusSelect.disabled = false;
                }
            });
        }

        lucide.createIcons();
    }

    // Generate Differential Diagnosis
    async function generateDifferentialDiagnosis() {
        if (!currentConsultation) return;

        try {
            generateDdxBtn.disabled = true;
            generateDdxBtn.innerHTML = `
                <i data-lucide="loader-circle" class="h-4 w-4 animate-spin"></i>
                <span>Generating...</span>
            `;
            ddxStatus.textContent = 'Analyzing patient data and medical reports...';

            const token = localStorage.getItem('accessToken');
            console.log('Generating DDx for consultation:', currentConsultation.id);
            
            let response = await api.generateDifferentialDiagnosis(currentConsultation.id, token);
            console.log('First API response status:', response.status);
            
            if (!response.ok) {
                console.log('First API call failed, trying fallback...');
                // Fallback to old function name
                response = await api.generateDdx(currentConsultation.id, token);
                console.log('Fallback API response status:', response.status);
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('API Error response:', errorText);
                    throw new Error(`Failed to generate differential diagnosis: ${response.status} ${errorText}`);
                }
            }
            
            const result = await response.json();
            console.log('DDx API response:', result);
            
            // Check for the correct field name
            const ddxContent = result.ddx_result || result.ddx || result.content || result.message;
            
            if (!ddxContent) {
                throw new Error('No DDx content received from server');
            }
            
            // Save the DDx result to the current consultation object
            currentConsultation.ddx_result = ddxContent;
            
            ddxResultDisplay.innerHTML = `
                <div class="p-4">
                    <div class="flex items-center space-x-3 mb-4">
                        <i data-lucide="brain-circuit" class="h-5 w-5 text-purple-600"></i>
                        <span class="font-medium text-gray-900">AI Differential Diagnosis</span>
                        <span class="px-2 py-1 bg-green-100 text-green-600 text-xs rounded-full">Generated</span>
                    </div>
                    <div class="prose prose-sm max-w-none">
                        ${formatDdxResult(ddxContent)}
                    </div>
                </div>
            `;
            
            ddxStatus.textContent = 'Differential diagnosis generated successfully';
            showNotification('Differential diagnosis generated!', 'success');
            
        } catch (error) {
            console.error('Error generating DDx:', error);
            ddxStatus.textContent = 'Failed to generate differential diagnosis';
            showNotification('Failed to generate differential diagnosis', 'error');
        } finally {
            generateDdxBtn.disabled = false;
            generateDdxBtn.innerHTML = `
                <i data-lucide="zap" class="h-4 w-4"></i>
                <span>Generate DDx</span>
            `;
        }
    }

    // Format DDx Result
    function formatDdxResult(ddx) {
        if (typeof ddx === 'string') {
            return ddx.replace(/\n/g, '<br>');
        }
        
        if (Array.isArray(ddx)) {
            return ddx.map(item => `<li>${item}</li>`).join('');
        }
        
        return JSON.stringify(ddx, null, 2);
    }

    // Display Saved DDx
    function displaySavedDdx(ddxContent) {
        console.log('Displaying saved DDx:', ddxContent);
        
        ddxResultDisplay.innerHTML = `
            <div class="p-4">
                <div class="flex items-center space-x-3 mb-4">
                    <i data-lucide="brain-circuit" class="h-5 w-5 text-purple-600"></i>
                    <span class="font-medium text-gray-900">AI Differential Diagnosis</span>
                    <span class="px-2 py-1 bg-green-100 text-green-600 text-xs rounded-full">Saved</span>
                </div>
                <div class="prose prose-sm max-w-none">
                    ${formatDdxResult(ddxContent)}
                </div>
            </div>
        `;
        
        ddxStatus.textContent = 'Differential diagnosis loaded from database';
        lucide.createIcons();
    }

    // Display Saved SOAP Note
    function displaySavedSoapNote(soapNote) {
        console.log('Displaying saved SOAP note:', soapNote);
        
        soapNoteDisplay.value = soapNote;
        
        // Update note status
        const noteStatus = document.getElementById('note-status');
        if (noteStatus) {
            noteStatus.textContent = 'Saved';
            noteStatus.className = 'px-2 py-1 bg-green-100 text-green-600 text-xs rounded-full';
        }
        
        // Update recording status
        if (recordingStatus) {
            recordingStatus.textContent = 'SOAP note loaded from database';
            recordingStatus.className = 'text-sm font-medium text-green-600';
        }
        
        showNotification('SOAP note loaded from database', 'success');
    }

    // Toggle Recording
    async function toggleRecording() {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    }

    // Start Recording
    async function startRecording() {
        try {
            // Check if MediaRecorder is supported
            if (!window.MediaRecorder) {
                showNotification('Recording is not supported in this browser. Please use a modern browser like Chrome, Firefox, or Safari.', 'error');
                return;
            }
            
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                } 
            });
            
            // Check for supported MIME types
            const supportedTypes = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/mp4',
                'audio/ogg;codecs=opus',
                'audio/wav'
            ];
            
            let selectedType = null;
            for (const type of supportedTypes) {
                if (MediaRecorder.isTypeSupported(type)) {
                    selectedType = type;
                    console.log('Using MIME type:', type);
                    break;
                }
            }
            
            if (!selectedType) {
                // Fallback to no MIME type specification
                mediaRecorder = new MediaRecorder(stream);
                console.log('Using default MIME type');
            } else {
                mediaRecorder = new MediaRecorder(stream, {
                    mimeType: selectedType
                });
            }
            
            recordedChunks = [];

            mediaRecorder.ondataavailable = (event) => {
                recordedChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(recordedChunks, { type: selectedType || 'audio/webm' });
                await processAudioRecording(audioBlob);
            };

            mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder error:', event.error);
                showNotification('Recording error occurred', 'error');
                stopRecording();
            };

            mediaRecorder.start(1000); // Collect data every second
            isRecording = true;
            
            // Update UI
            recordBtn.innerHTML = `
                <i data-lucide="square" class="h-5 w-5 recording-indicator"></i>
                <span>Stop Recording</span>
            `;
            recordBtn.className = 'btn-recording flex items-center space-x-2';
            
            // Show recording indicator
            const recordingIndicator = document.getElementById('recording-indicator');
            if (recordingIndicator) {
                recordingIndicator.classList.remove('hidden');
            }
            
            recordingStatus.textContent = 'Recording... Click to stop';
            recordingStatus.className = 'text-sm font-medium text-red-600 recording-indicator';
            
            // Update note status
            const noteStatus = document.getElementById('note-status');
            if (noteStatus) {
                noteStatus.textContent = 'Recording';
                noteStatus.className = 'px-2 py-1 bg-red-100 text-red-600 text-xs rounded-full';
            }
            
            showNotification('Recording started - speak clearly for best results', 'info');
            
        } catch (error) {
            console.error('Error starting recording:', error);
            let errorMessage = 'Failed to start recording';
            
            if (error.name === 'NotSupportedError') {
                errorMessage = 'Audio recording is not supported in this browser. Please use Chrome, Firefox, or Safari.';
            } else if (error.name === 'NotAllowedError') {
                errorMessage = 'Microphone access denied. Please allow microphone access and try again.';
            } else if (error.name === 'NotFoundError') {
                errorMessage = 'No microphone found. Please connect a microphone and try again.';
            } else if (error.name === 'NotReadableError') {
                errorMessage = 'Microphone is already in use by another application. Please close other apps using the microphone.';
            } else {
                errorMessage += ': ' + error.message;
            }
            
            showNotification(errorMessage, 'error');
        }
    }

    // Stop Recording
    function stopRecording() {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
            isRecording = false;
            
            // Update UI
            recordBtn.innerHTML = `
                <i data-lucide="mic" class="h-5 w-5"></i>
                <span>Start Recording</span>
            `;
            recordBtn.className = 'btn-primary flex items-center space-x-2';
            
            // Hide recording indicator
            const recordingIndicator = document.getElementById('recording-indicator');
            if (recordingIndicator) {
                recordingIndicator.classList.add('hidden');
            }
            
            recordingStatus.textContent = 'Processing audio...';
            recordingStatus.className = 'text-sm font-medium text-blue-600';
            
            // Update note status
            const noteStatus = document.getElementById('note-status');
            if (noteStatus) {
                noteStatus.textContent = 'Processing';
                noteStatus.className = 'px-2 py-1 bg-blue-100 text-blue-600 text-xs rounded-full';
            }
            
            showNotification('Processing audio recording...', 'info');
        }
    }

    // Process Audio Recording
    async function processAudioRecording(audioBlob) {
        try {
            // Show processing indicator
            recordingStatus.textContent = 'Processing audio...';
            recordingStatus.className = 'text-sm font-medium text-blue-600';
            
            // Create a more descriptive filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `consultation_${currentConsultation.id}_${timestamp}.webm`;

            const token = localStorage.getItem('accessToken');
            const response = await api.createNoteFromAudio(currentConsultation.id, audioBlob, token);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Failed to process audio recording');
            }
            
            const result = await response.json();
            
            if (result.soap_note) {
                // Save to local state
                currentConsultation.soap_note = result.soap_note;
                soapNoteDisplay.value = result.soap_note;
                
                showNotification('SOAP note generated successfully from audio', 'success');
                recordingStatus.textContent = 'SOAP note generated successfully';
                recordingStatus.className = 'text-sm font-medium text-green-600';
                
                // Update note status
                const noteStatus = document.getElementById('note-status');
                if (noteStatus) {
                    noteStatus.textContent = 'Generated';
                    noteStatus.className = 'px-2 py-1 bg-green-100 text-green-600 text-xs rounded-full';
                }
                
                // Auto-save the SOAP note
                if (currentConsultation.id) {
                    await saveSoapNote(result.soap_note);
                }
            } else {
                showNotification('No SOAP note generated from audio - please try again', 'warning');
                recordingStatus.textContent = 'No SOAP note generated';
                recordingStatus.className = 'text-sm font-medium text-yellow-600';
                
                // Update note status
                const noteStatus = document.getElementById('note-status');
                if (noteStatus) {
                    noteStatus.textContent = 'Failed';
                    noteStatus.className = 'px-2 py-1 bg-red-100 text-red-600 text-xs rounded-full';
                }
            }
            
        } catch (error) {
            console.error('Error processing audio:', error);
            showNotification('Failed to process audio: ' + error.message, 'error');
            recordingStatus.textContent = 'Failed to process audio';
            recordingStatus.className = 'text-sm font-medium text-red-600';
        }
    }

    // Save SOAP Note
    async function saveSoapNote(soapNote) {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${API_BASE_URL}/consultations/${currentConsultation.id}/soap-note`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ soap_note: soapNote })
            });
            
            if (!response.ok) {
                console.warn('Failed to save SOAP note to server');
            }
        } catch (error) {
            console.error('Error saving SOAP note:', error);
        }
    }

    // Clear SOAP Note
    function clearSoapNote() {
        if (confirm('Are you sure you want to clear the SOAP note?')) {
            // Clear local state
            currentConsultation.soap_note = '';
            soapNoteDisplay.value = '';
            
            const noteStatus = document.getElementById('note-status');
            if (noteStatus) {
                noteStatus.textContent = 'Cleared';
                noteStatus.className = 'px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full';
            }
            showNotification('SOAP note cleared', 'info');
        }
    }

    // Save SOAP Note (from button)
    async function saveSoapNote() {
        const soapNote = soapNoteDisplay.value.trim();
        if (!soapNote) {
            showNotification('No SOAP note to save', 'warning');
            return;
        }

        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${API_BASE_URL}/consultations/${currentConsultation.id}/soap-note`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ soap_note: soapNote })
            });
            
            if (response.ok) {
                // Update local state
                currentConsultation.soap_note = soapNote;
                
                const noteStatus = document.getElementById('note-status');
                if (noteStatus) {
                    noteStatus.textContent = 'Saved';
                    noteStatus.className = 'px-2 py-1 bg-green-100 text-green-600 text-xs rounded-full';
                }
                showNotification('SOAP note saved successfully', 'success');
            } else {
                showNotification('Failed to save SOAP note', 'error');
            }
        } catch (error) {
            console.error('Error saving SOAP note:', error);
            showNotification('Failed to save SOAP note', 'error');
        }
    }

    // Handle File Upload
    async function handleFileUpload(e) {
        e.preventDefault();
        
        const file = reportFile.files[0];
        if (!file) {
            showNotification('Please select a file', 'error');
            return;
        }

        try {
            uploadStatus.textContent = 'Uploading...';
            uploadStatus.className = 'mt-4 text-sm font-medium text-blue-600';

            const formData = new FormData();
            formData.append('file', file);
            formData.append('consultation_id', currentConsultation.id);

            const token = localStorage.getItem('accessToken');
            const response = await api.uploadReport(formData, token);
            
            if (!response.ok) throw new Error('Failed to upload report');
            
            const result = await response.json();
            uploadedReports.push(result);
            
            uploadStatus.textContent = 'Report uploaded successfully!';
            uploadStatus.className = 'mt-4 text-sm font-medium text-green-600';
            
            showNotification('Report uploaded successfully!', 'success');
            loadReports();
            
            // Reset form
            uploadForm.reset();
            
        } catch (error) {
            console.error('Error uploading report:', error);
            uploadStatus.textContent = 'Failed to upload report';
            uploadStatus.className = 'mt-4 text-sm font-medium text-red-600';
            showNotification('Failed to upload report', 'error');
        }
    }

    // Load Reports
    async function loadReports() {
        try {
            const token = localStorage.getItem('accessToken');
            let response = await api.getConsultationReports(currentConsultation.id, token);
            
            if (!response.ok) {
                // Fallback to the old getReports function
                response = await api.getReports(currentConsultation.id, token);
                if (!response.ok) {
                    console.log('No reports found for this consultation');
                    renderReports([]);
                    return;
                }
            }
            
            const reports = await response.json();
            renderReports(reports);
            
            // Show chat widget if reports are available
            if (reports.length > 0) {
                aiChatWidget?.classList.remove('hidden');
            }
            
        } catch (error) {
            console.error('Error loading reports:', error);
            // Don't show error notification, just render empty reports
            renderReports([]);
        }
    }

    // Load Patient History
    async function loadPatientHistory(patientId) {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await api.getPatientHistory(patientId, token);
            
            if (!response.ok) {
                console.log('No patient history found');
                renderPatientHistory([]);
                return;
            }
            
            const history = await response.json();
            renderPatientHistory(history);
            
        } catch (error) {
            console.error('Error loading patient history:', error);
            renderPatientHistory([]);
        }
    }

    // Render Patient History
    function renderPatientHistory(history) {
        if (!patientHistoryList) return;

        patientHistoryList.innerHTML = '';

        if (history.length === 0) {
            patientHistoryList.innerHTML = `
                <div class="text-center py-8">
                    <i data-lucide="history" class="mx-auto h-12 w-12 text-gray-400 mb-4"></i>
                    <h3 class="text-lg font-medium text-gray-900 mb-2">No previous consultations</h3>
                    <p class="text-gray-600">This is the first consultation with this patient</p>
                </div>
            `;
            return;
        }

        history.forEach(consultation => {
            const statusRaw = consultation.status || 'scheduled';
            const status = statusRaw.charAt(0).toUpperCase() + statusRaw.slice(1);
            const scheduled = consultation.scheduled_time ? new Date(consultation.scheduled_time).toLocaleDateString() : '';
            const ddxPreview = consultation.ddx_result ? consultation.ddx_result.substring(0, 200) + (consultation.ddx_result.length > 200 ? '...' : '') : '';
            const viewBtn = consultation.id ? `<button class=\"btn-primary btn-xs flex items-center space-x-2 px-3 py-1 ml-4\" onclick=\"window.location.href='consultation.html?id=${consultation.id}'\"><i data-lucide=\"arrow-right-circle\" class=\"h-4 w-4\"></i><span>View</span></button>` : '';
            const historyCard = document.createElement('div');
            historyCard.className = 'p-4 bg-gray-50 rounded-xl border border-gray-200 mb-3 transition-colors cursor-pointer hover:bg-blue-50';
            historyCard.innerHTML = `
                <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center space-x-3">
                        <div class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                            <i data-lucide="calendar" class="h-4 w-4 text-blue-600"></i>
                        </div>
                        <div>
                            <h4 class="font-medium text-gray-900">Consultation #${consultation.id || ''}</h4>
                            <p class="text-sm text-gray-500">${scheduled}</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2">
                        ${status ? `<span class=\"status-badge status-${statusRaw}\">${status}</span>` : ''}
                        ${viewBtn}
                    </div>
                </div>
                ${ddxPreview ? `
                    <div class="mt-3 p-3 bg-white rounded-lg border border-gray-200">
                        <h5 class="text-sm font-medium text-gray-700 mb-2">Previous DDx:</h5>
                        <p class="text-sm text-gray-600">${ddxPreview}</p>
                    </div>
                ` : ''}
            `;
            if (consultation.id) {
                historyCard.addEventListener('click', (e) => {
                    // Prevent double navigation if button is clicked
                    if (e.target.closest('button')) return;
                    window.location.href = `consultation.html?id=${consultation.id}`;
                });
            }
            patientHistoryList.appendChild(historyCard);
        });

        lucide.createIcons();
    }

    // Render Reports
    function renderReports(reports) {
        if (!reportsListContainer) return;

        reportsListContainer.innerHTML = '';

        if (reports.length === 0) {
            reportsListContainer.innerHTML = `
                <div class="text-center py-8">
                    <i data-lucide="file-text" class="mx-auto h-12 w-12 text-gray-400 mb-4"></i>
                    <h3 class="text-lg font-medium text-gray-900 mb-2">No reports uploaded</h3>
                    <p class="text-gray-600">Upload medical reports to get started with AI analysis</p>
                </div>
            `;
            return;
        }

        reports.forEach(report => {
            const reportCard = document.createElement('div');
            reportCard.className = 'bg-gray-50 rounded-xl border border-gray-200 overflow-hidden';
            
            const filename = report.file_path ? report.file_path.split('/').pop() : 'Unknown file';
            const hasSummary = report.summary && report.summary.trim() !== '';
            
            reportCard.innerHTML = `
                <div class="p-4 border-b border-gray-200">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <i data-lucide="file-text" class="h-5 w-5 text-blue-600"></i>
                            </div>
                            <div>
                                <h4 class="font-medium text-gray-900">${filename}</h4>
                                <p class="text-sm text-gray-500">Uploaded ${new Date(report.uploaded_at).toLocaleDateString()}</p>
                            </div>
                        </div>
                        <div class="flex items-center space-x-2">
                            ${hasSummary ? `
                                <span class="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                                    <i data-lucide="check-circle" class="h-3 w-3 inline mr-1"></i>
                                    Analyzed
                                </span>
                            ` : `
                                <span class="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium">
                                    <i data-lucide="clock" class="h-3 w-3 inline mr-1"></i>
                                    Processing
                                </span>
                            `}
                            <button onclick="downloadReport(${report.id})" class="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                <i data-lucide="download" class="h-4 w-4"></i>
                            </button>
                            <button onclick="deleteReport(${report.id})" class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                <i data-lucide="trash-2" class="h-4 w-4"></i>
                            </button>
                        </div>
                    </div>
                </div>
                ${hasSummary ? `
                    <div class="p-4 bg-white">
                        <div class="flex items-center space-x-2 mb-3">
                            <i data-lucide="brain" class="h-4 w-4 text-blue-600"></i>
                            <h5 class="font-medium text-gray-900">AI Summary</h5>
                        </div>
                        <div class="text-sm text-gray-700 prose prose-sm max-w-none">
                            ${formatReportSummary(report.summary)}
                        </div>
                        <button onclick="askAboutReport(${report.id})" class="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center space-x-1">
                            <i data-lucide="message-circle" class="h-3 w-3"></i>
                            <span>Ask about this report</span>
                        </button>
                    </div>
                ` : ''}
            `;
            reportsListContainer.appendChild(reportCard);
        });

        lucide.createIcons();
    }

    // Format Report Summary
    function formatReportSummary(summary) {
        if (!summary) return '<p class="text-gray-500">No summary available</p>';
        
        // Convert markdown-like formatting to HTML
        return summary
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded text-xs">$1</code>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/^/, '<p>')
            .replace(/$/, '</p>');
    }

    // Analyze Reports
    async function analyzeReports() {
        if (!currentConsultation) return;

        const analyzeBtn = document.getElementById('analyze-reports-btn');
        const analysisStatus = document.getElementById('analysis-status');
        const keyFindings = document.getElementById('key-findings');
        const abnormalValues = document.getElementById('abnormal-values');
        const comprehensiveSummary = document.getElementById('comprehensive-summary');

        try {
            // Update UI
            analyzeBtn.disabled = true;
            analyzeBtn.innerHTML = `
                <i data-lucide="loader-circle" class="h-4 w-4 animate-spin"></i>
                <span>Analyzing...</span>
            `;
            analysisStatus.textContent = 'Analyzing all uploaded reports...';
            analysisStatus.className = 'text-sm font-medium text-blue-600';

            const token = localStorage.getItem('accessToken');
            
            // Get key findings
            const findingsResponse = await api.askAI(currentConsultation.id, "What are the key findings from all the medical reports? Please list them clearly.", token);
            if (findingsResponse.ok) {
                const findings = await findingsResponse.json();
                keyFindings.innerHTML = formatAnalysisResult(findings.answer);
            }

            // Get abnormal values
            const abnormalResponse = await api.askAI(currentConsultation.id, "What abnormal values or concerning results are present in the medical reports? Please list them specifically.", token);
            if (abnormalResponse.ok) {
                const abnormal = await abnormalResponse.json();
                abnormalValues.innerHTML = formatAnalysisResult(abnormal.answer);
            }

            // Get comprehensive summary
            const summaryResponse = await api.askAI(currentConsultation.id, "Provide a comprehensive summary of all medical reports, including diagnoses, test results, and recommendations.", token);
            if (summaryResponse.ok) {
                const summary = await summaryResponse.json();
                comprehensiveSummary.innerHTML = formatAnalysisResult(summary.answer);
            }

            analysisStatus.textContent = 'Analysis completed successfully';
            analysisStatus.className = 'text-sm font-medium text-green-600';
            showNotification('Report analysis completed successfully', 'success');

        } catch (error) {
            console.error('Error analyzing reports:', error);
            analysisStatus.textContent = 'Failed to analyze reports';
            analysisStatus.className = 'text-sm font-medium text-red-600';
            showNotification('Failed to analyze reports', 'error');
        } finally {
            analyzeBtn.disabled = false;
            analyzeBtn.innerHTML = `
                <i data-lucide="zap" class="h-4 w-4"></i>
                <span>Analyze Reports</span>
            `;
        }
    }

    // Format Analysis Result
    function formatAnalysisResult(result) {
        if (!result) return '<p class="text-gray-500">No analysis available</p>';
        
        return result
            .replace(/\*\*(.*?)\*\*/g, '<strong class="text-gray-900">$1</strong>')
            .replace(/\*(.*?)\*/g, '<em class="text-gray-700">$1</em>')
            .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded text-xs font-mono">$1</code>')
            .replace(/\n\n/g, '</p><p class="mt-2">')
            .replace(/\n/g, '<br>')
            .replace(/^/, '<p>')
            .replace(/$/, '</p>');
    }

    // Ask About Specific Report
    window.askAboutReport = function(reportId) {
        // Open chat widget and ask about the specific report
        aiChatWidget?.classList.remove('hidden');
        aiChatWidget?.classList.remove('minimized');
        chatWidgetBody.style.display = 'flex';
        
        // Set a default question about the report
        aiQuestionInput.value = `Tell me about the findings in this report`;
        aiQuestionInput.focus();
        
        // Trigger the chat
        setTimeout(() => {
            aiChatForm?.dispatchEvent(new Event('submit'));
        }, 500);
    };

    // Setup Drag and Drop
    function setupDragAndDrop() {
        const uploadArea = document.querySelector('#upload-form');
        
        if (!uploadArea) return;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, unhighlight, false);
        });

        function highlight(e) {
            uploadArea.classList.add('border-blue-400', 'bg-blue-50');
        }

        function unhighlight(e) {
            uploadArea.classList.remove('border-blue-400', 'bg-blue-50');
        }

        uploadArea.addEventListener('drop', handleDrop, false);

        function handleDrop(e) {
            const dt = e.dataTransfer;
            const files = dt.files;
            
            if (files.length > 0) {
                reportFile.files = files;
            }
        }
    }

    // Setup Chat Widget
    function setupChatWidget() {
        console.log('Setting up chat widget...');
        console.log('Chat widget elements:', {
            aiChatWidget: !!aiChatWidget,
            chatWidgetHeader: !!chatWidgetHeader,
            chatWidgetBody: !!chatWidgetBody,
            chatWindow: !!chatWindow
        });
        
        // Test if elements are actually found
        if (aiChatWidget) {
            console.log('Chat widget found:', aiChatWidget);
            console.log('Chat widget classes:', aiChatWidget.className);
        }
        
        if (chatWidgetHeader) {
            console.log('Chat header found:', chatWidgetHeader);
            console.log('Chat header classes:', chatWidgetHeader.className);
        }
        
        // Chat widget minimize/restore functionality
        if (chatWidgetHeader) {
            // Simple click handler for the entire header
            chatWidgetHeader.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Chat header clicked - toggling');
                toggleChatWidget();
            });
            
            // Also add click handler to any icon in the header
            const headerIcons = chatWidgetHeader.querySelectorAll('[data-lucide]');
            headerIcons.forEach(icon => {
                icon.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Header icon clicked:', icon.getAttribute('data-lucide'));
                    toggleChatWidget();
                });
            });
            
            // Add mousedown and touchstart for better click detection
            chatWidgetHeader.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Chat header mousedown - toggling');
                toggleChatWidget();
            });
            
            chatWidgetHeader.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Chat header touchstart - toggling');
                toggleChatWidget();
            });
            
                    // Add click handler to the entire chat widget as fallback
        if (aiChatWidget) {
            // Simple click handler for minimized state
            aiChatWidget.addEventListener('click', (e) => {
                if (aiChatWidget.classList.contains('minimized')) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Minimized chat widget clicked');
                    toggleChatWidget();
                }
            });
            
            // Add mousedown and touchstart for better click detection when minimized
            aiChatWidget.addEventListener('mousedown', (e) => {
                if (aiChatWidget.classList.contains('minimized')) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Minimized chat widget mousedown');
                    toggleChatWidget();
                }
            });
            
            aiChatWidget.addEventListener('touchstart', (e) => {
                if (aiChatWidget.classList.contains('minimized')) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Minimized chat widget touchstart');
                    toggleChatWidget();
                }
            });
            
            // Add listener for custom toggle event
            aiChatWidget.addEventListener('toggle-chat', () => {
                console.log('Custom toggle event received');
                toggleChatWidget();
            });
        }
        }

        // Prevent chat window scroll from affecting main page
        if (chatWindow) {
            chatWindow.addEventListener('scroll', (e) => {
                e.stopPropagation();
            });
        }

        // Auto-resize input field
        if (aiQuestionInput) {
            aiQuestionInput.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = Math.min(this.scrollHeight, 120) + 'px';
            });
        }

        // Keyboard shortcuts
        if (aiQuestionInput) {
            aiQuestionInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    aiChatForm?.dispatchEvent(new Event('submit'));
                }
                if (e.key === 'Escape') {
                    toggleChatWidget();
                }
            });
        }

        // Show chat widget when reports are available
        if (uploadedReports.length > 0) {
            aiChatWidget?.classList.remove('hidden');
        }
        
        // Always show chat widget for testing
        if (aiChatWidget) {
            aiChatWidget.classList.remove('hidden');
            console.log('Chat widget made visible');
        }
        
        console.log('Chat widget setup complete');
    }

    // Toggle Chat Widget
    function toggleChatWidget() {
        console.log('toggleChatWidget called');
        
        if (!aiChatWidget) {
            console.error('aiChatWidget not found');
            return;
        }
        
        if (!chatWidgetBody) {
            console.error('chatWidgetBody not found');
            return;
        }

        const isMinimized = aiChatWidget.classList.contains('minimized');
        
        console.log('Current state:', isMinimized ? 'minimized' : 'expanded');
        
        if (isMinimized) {
            // Expand chat
            console.log('Expanding chat widget');
            aiChatWidget.classList.remove('minimized');
            
            // Show chat body
            setTimeout(() => {
                if (chatWidgetBody) {
                    chatWidgetBody.style.display = 'flex';
                    chatWidgetBody.style.visibility = 'visible';
                    chatWidgetBody.style.opacity = '1';
                    chatWidgetBody.style.height = 'auto';
                    chatWidgetBody.style.overflow = 'visible';
                }
            }, 100);
            
            // Update header icon
            const headerIcon = chatWidgetHeader?.querySelector('[data-lucide="chevron-down"]');
            if (headerIcon) {
                headerIcon.setAttribute('data-lucide', 'chevron-up');
            }
            
            // Also update any chevron-up icons to chevron-down for consistency
            const upIcon = chatWidgetHeader?.querySelector('[data-lucide="chevron-up"]');
            if (upIcon) {
                upIcon.setAttribute('data-lucide', 'chevron-down');
            }
            
            // Restore scroll position
            setTimeout(() => {
                if (chatWindow) {
                    chatWindow.scrollTop = chatScrollPosition || 0;
                }
            }, 200);
            
        } else {
            // Minimize chat
            console.log('Minimizing chat widget');
            chatScrollPosition = chatWindow ? chatWindow.scrollTop : 0;
            aiChatWidget.classList.add('minimized');
            
            // Hide chat body
            if (chatWidgetBody) {
                chatWidgetBody.style.display = 'none';
                chatWidgetBody.style.visibility = 'hidden';
                chatWidgetBody.style.opacity = '0';
                chatWidgetBody.style.height = '0';
                chatWidgetBody.style.overflow = 'hidden';
            }
            
            // Update header icon
            const headerIcon = chatWidgetHeader?.querySelector('[data-lucide="chevron-up"]');
            if (headerIcon) {
                headerIcon.setAttribute('data-lucide', 'chevron-down');
            }
            
            // Also update any chevron-down icons to chevron-up for consistency
            const downIcon = chatWidgetHeader?.querySelector('[data-lucide="chevron-down"]');
            if (downIcon) {
                downIcon.setAttribute('data-lucide', 'chevron-up');
            }
        }
        
        // Force re-render of icons
        setTimeout(() => {
            lucide.createIcons();
        }, 100);
        
        console.log('Toggle complete. New state:', aiChatWidget.classList.contains('minimized') ? 'minimized' : 'expanded');
    }

    // Handle AI Chat
    async function handleAiChat(e) {
        e.preventDefault();
        
        const question = aiQuestionInput.value.trim();
        if (!question) return;

        // Add user message to chat
        addChatMessage(question, 'user');
        aiQuestionInput.value = '';

        try {
            const token = localStorage.getItem('accessToken');
            const response = await api.askAI(currentConsultation.id, question, token);
            
            if (!response.ok) throw new Error('Failed to get AI response');
            
            const result = await response.json();
            addChatMessage(result.answer, 'assistant');
            
        } catch (error) {
            console.error('Error asking question:', error);
            addChatMessage('Sorry, I encountered an error. Please try again.', 'assistant');
        }
    }

    // Add Chat Message
    function addChatMessage(message, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `flex ${sender === 'user' ? 'justify-end' : 'justify-start'} mb-4 animate-fade-in`;
        
        messageDiv.innerHTML = `
            <div class="max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
                sender === 'user' 
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white' 
                    : 'bg-gray-100 text-gray-800'
            }">
                <div class="text-sm">${formatMessage(message)}</div>
                <div class="text-xs opacity-70 mt-1">${new Date().toLocaleTimeString()}</div>
            </div>
        `;
        
        chatWindow.appendChild(messageDiv);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    // Format Message
    function formatMessage(message) {
        // Simple markdown-like formatting
        return message
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code class="bg-gray-200 px-1 rounded">$1</code>')
            .replace(/\n/g, '<br>');
    }

    // Show Error
    function showError(message) {
        consultationDetailsContainer.innerHTML = `
            <div class="text-center py-12">
                <i data-lucide="alert-circle" class="mx-auto h-12 w-12 text-red-500 mb-4"></i>
                <h3 class="text-lg font-medium text-gray-900 mb-2">Error</h3>
                <p class="text-gray-600">${message}</p>
            </div>
        `;
        lucide.createIcons();
    }

    // Show Notification
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type} animate-fade-in-up`;
        notification.innerHTML = `
            <div class="flex items-center space-x-3">
                <i data-lucide="${getNotificationIcon(type)}" class="h-5 w-5"></i>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(-10px)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 200);
        }, 5000);

        lucide.createIcons();
    }

    function getNotificationIcon(type) {
        switch (type) {
            case 'success': return 'check-circle';
            case 'error': return 'x-circle';
            case 'warning': return 'alert-triangle';
            default: return 'info';
        }
    }

    // Global functions for report actions
    window.downloadReport = async function(reportId) {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await api.downloadReport(reportId, token);
            
            if (!response.ok) throw new Error('Failed to download report');
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `report_${reportId}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
        } catch (error) {
            console.error('Error downloading report:', error);
            showNotification('Failed to download report', 'error');
        }
    };

    window.deleteReport = async function(reportId) {
        if (!confirm('Are you sure you want to delete this report?')) return;
        
        try {
            const token = localStorage.getItem('accessToken');
            const response = await api.deleteReport(reportId, token);
            
            if (!response.ok) throw new Error('Failed to delete report');
            
            showNotification('Report deleted successfully', 'success');
            loadReports();
            
        } catch (error) {
            console.error('Error deleting report:', error);
            showNotification('Failed to delete report', 'error');
        }
    };

    // Initialize
    initialize();
});

