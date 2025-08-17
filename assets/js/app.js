// Global variable to store the text content of the uploaded PDF
let pdfTextContent = '';
// Global variable to store the PDF file for preview rendering
let pdfFile = null;

// DOM elements
const fileInput = document.getElementById('file-input');
const uploadButton = document.getElementById('upload-button');
const uploadStatus = document.getElementById('upload-status');
const fileDropArea = document.getElementById('file-drop-area');
const workspaceSection = document.getElementById('workspace-section');
const uploadSection = document.getElementById('upload-section');
const pdfViewerContainer = document.getElementById('pdf-viewer-container');
const summaryOptions = document.getElementById('summary-options');
const summaryOutput = document.getElementById('summary-output');
const regenerateButton = document.getElementById('regenerate-button');
const copyButton = document.getElementById('copy-button');
const downloadButton = document.getElementById('download-button');
const pdfStatus = document.getElementById('pdf-status');

// Function to render a PDF page onto a canvas
const renderPage = async (page) => {
    const scale = 1.5;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
        canvasContext: context,
        viewport,
    };
    await page.render(renderContext).promise;
    return canvas;
};

// Function to display the PDF in the viewer
const displayPdf = async (file) => {
    const loadingTask = pdfjsLib.getDocument({ url: URL.createObjectURL(file) });
    pdfStatus.textContent = 'Rendering PDF...';
    pdfStatus.classList.remove('hidden');
    
    try {
        const pdf = await loadingTask.promise;
        const pdfPagesContainer = document.getElementById('pdf-pages');
        pdfPagesContainer.innerHTML = ''; // Clear previous pages
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const canvas = await renderPage(page);
            pdfPagesContainer.appendChild(canvas);
        }
        pdfStatus.classList.add('hidden');
    } catch (error) {
        pdfStatus.textContent = 'Failed to render PDF preview.';
        console.error('PDF rendering error:', error);
    }
};

// Function to fetch the summary from the backend
const fetchSummary = async (prompt) => {
    const formData = new FormData();
    formData.append('pdf', pdfFile); // Use the global file object
    formData.append('prompt', prompt);

    try {
        const response = await fetch('/api/summarize', {
            method: 'POST',
            body: formData,
        });
        const data = await response.json();
        if (response.ok) {
            return data.candidates[0].content.parts[0].text;
        } else {
            throw new Error(data.error || 'Server error.');
        }
    } catch (error) {
        throw new Error(`Error: ${error.message}`);
    }
};

// Function to handle the file and initiate processing
const handleFile = async (file) => {
    if (file && file.type === 'application/pdf') {
        pdfFile = file;
        uploadStatus.textContent = 'Processing...';
        
        try {
            await displayPdf(file);
            
            // Get text from the PDF for summarization
            const text = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const data = new Uint8Array(e.target.result);
                    const pdf = await pdfjsLib.getDocument({ data }).promise;
                    let fullText = '';
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        fullText += textContent.items.map(item => item.str).join(' ');
                    }
                    resolve(fullText);
                };
                reader.readAsArrayBuffer(file);
            });

            pdfTextContent = text;
            summaryOutput.textContent = 'Generating summary...';
            const defaultPrompt = `Summarize this document: ${pdfTextContent}`;
            const summary = await fetchSummary(defaultPrompt);
            
            summaryOutput.textContent = summary;
            uploadStatus.textContent = 'Summary generated successfully!';
            uploadSection.classList.add('hidden');
            workspaceSection.classList.remove('hidden');
        } catch (error) {
            uploadStatus.textContent = `Error: ${error.message}`;
            console.error(error);
        }
    } else {
        uploadStatus.textContent = 'Please select a PDF file.';
    }
};

// Event Listeners
uploadButton.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (event) => {
    handleFile(event.target.files[0]);
});

fileDropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileDropArea.classList.add('border-blue-500', 'bg-gray-50', 'dark:bg-slate-800');
});

fileDropArea.addEventListener('dragleave', () => {
    fileDropArea.classList.remove('border-blue-500', 'bg-gray-50', 'dark:bg-slate-800');
});

fileDropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    fileDropArea.classList.remove('border-blue-500', 'bg-gray-50', 'dark:bg-slate-800');
    const file = e.dataTransfer.files[0];
    handleFile(file);
});

// Event listeners for summary options
summaryOptions.addEventListener('click', async (e) => {
    const button = e.target.closest('button');
    if (!button) return;

    // Remove active class from all buttons
    summaryOptions.querySelectorAll('button').forEach(btn => {
        btn.classList.remove('bg-white', 'text-blue-600', 'shadow-sm', 'dark:bg-slate-900', 'dark:text-blue-400');
        btn.classList.add('text-gray-700', 'dark:text-gray-300', 'hover:bg-white', 'dark:hover:bg-slate-900');
    });

    // Add active class to the clicked button
    button.classList.add('bg-white', 'text-blue-600', 'shadow-sm', 'dark:bg-slate-900', 'dark:text-blue-400');
    button.classList.remove('text-gray-700', 'dark:text-gray-300', 'hover:bg-white', 'dark:hover:bg-slate-900');

    // Generate summary based on the selected type
    const type = button.dataset.type;
    const prompt = `Summarize this document as a ${type} summary: ${pdfTextContent}`;
    
    summaryOutput.textContent = 'Generating new summary...';
    try {
        const summary = await fetchSummary(prompt);
        summaryOutput.textContent = summary;
    } catch (error) {
        summaryOutput.textContent = `Error: ${error.message}`;
    }
});

// Event listener for the Regenerate button
regenerateButton.addEventListener('click', async () => {
    const activeButton = summaryOptions.querySelector('button.bg-white');
    const type = activeButton ? activeButton.dataset.type : 'concise';
    const prompt = `Summarize this document as a ${type} summary: ${pdfTextContent}`;

    summaryOutput.textContent = 'Regenerating summary...';
    try {
        const summary = await fetchSummary(prompt);
        summaryOutput.textContent = summary;
    } catch (error) {
        summaryOutput.textContent = `Error: ${error.message}`;
    }
});

// Event listener for the Copy button
copyButton.addEventListener('click', () => {
    const textToCopy = summaryOutput.textContent;
    navigator.clipboard.writeText(textToCopy).then(() => {
        alert('Summary copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        alert('Failed to copy summary.');
    });
});

// Event listener for the Download button
downloadButton.addEventListener('click', () => {
    const summaryText = summaryOutput.textContent;
    if (summaryText) {
        const blob = new Blob([summaryText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'summary.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
});