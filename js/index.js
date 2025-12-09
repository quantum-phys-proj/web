

const startButton = document.getElementById('start-button');
const sessionOptions = document.getElementById('session-options');
const backButton = document.getElementById('back-button');
const sessionFileInput = document.getElementById('session-file-input');
const fileNameDisplay = document.getElementById('file-name-display');
const loadSessionBtn = document.getElementById('load-session-btn');
const createSessionBtn = document.getElementById('create-session-btn');

let loading = false;
let selectedFile = null;


startButton.addEventListener('click', () => {
    
    
    startButton.classList.add('hidden');
    sessionOptions.classList.remove('hidden');
    backButton.classList.remove('hidden');
});


backButton.addEventListener('click', () => {
    sessionOptions.classList.add('hidden');
    backButton.classList.add('hidden');
    startButton.classList.remove('hidden');
    
    sessionFileInput.value = '';
    selectedFile = null;
    fileNameDisplay.textContent = 'Выберите JSON файл...';
    fileNameDisplay.classList.add('text-gray-400');
    loadSessionBtn.disabled = true;
});


sessionFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        if (file.type === 'application/json' || file.name.endsWith('.json')) {
            selectedFile = file;
            fileNameDisplay.textContent = file.name;
            fileNameDisplay.classList.remove('text-gray-400');
            fileNameDisplay.classList.add('text-white');
            loadSessionBtn.disabled = false;
        } else {
            alert('Пожалуйста, выберите JSON файл');
            sessionFileInput.value = '';
            selectedFile = null;
            fileNameDisplay.textContent = 'Выберите JSON файл...';
            fileNameDisplay.classList.add('text-gray-400');
            loadSessionBtn.disabled = true;
        }
    }
});


loadSessionBtn.addEventListener('click', async () => {
    if (loading || !selectedFile) return;
    
    loading = true;
    loadSessionBtn.disabled = true;
    loadSessionBtn.textContent = 'Загрузка...';
    
    try {
        const fileContent = await readFileAsText(selectedFile);
        const sessionData = JSON.parse(fileContent);
        
        
        sessionStorage.setItem('sessionData', JSON.stringify(sessionData));
        
        console.log('Загружена сессия:', sessionData);
        
        
        window.location.href = 'simulation.html';
        
    } catch (error) {
        console.error('Ошибка при загрузке файла:', error);
        alert('Ошибка при загрузке файла. Убедитесь, что файл содержит валидный JSON.');
        loading = false;
        loadSessionBtn.disabled = false;
        loadSessionBtn.textContent = 'Загрузить сохранение';
    }
});


createSessionBtn.addEventListener('click', () => {
    if (loading) return;
    
    loading = true;
    createSessionBtn.disabled = true;
    createSessionBtn.textContent = 'Создаем сессию...';
    
    
    window.location.href = 'simulation.html';
});


function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
}


function saveToJSONFile(data, filename = 'session.json') {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}


window.saveSessionToFile = saveToJSONFile;

