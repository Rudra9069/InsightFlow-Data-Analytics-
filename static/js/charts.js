document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('upload-form');
    const fileInput = document.getElementById('file-input');
    const dropZone = document.getElementById('drop-zone');
    const fileNameDisplay = document.getElementById('file-name-display');
    const analyzeBtn = document.getElementById('analyze-btn');
    const loadingDiv = document.getElementById('loading');
    const resultsSection = document.getElementById('results');
    const chartsContainer = document.getElementById('charts-container');
    const reuploadBtn = document.getElementById('reupload-btn');

    // Drag and drop logic
    dropZone.onclick = () => fileInput.click();
    
    fileInput.onchange = (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            fileNameDisplay.textContent = `Selected: ${file.name}`;
            analyzeBtn.disabled = false;
            reuploadBtn.style.display = 'inline-block';
            // Add a "pressed" effect to the dropzone
            dropZone.style.boxShadow = 'inset 8px 8px 16px var(--shadow-dark), inset -8px -8px 16px var(--shadow-light)';
        }
    };

    let currentChartData = [];
    let activeCharts = [];

    reuploadBtn.onclick = () => {
        resultsSection.style.display = 'none';
        chartsContainer.innerHTML = '';
        currentChartData = [];
        activeCharts.forEach(c => c.destroy());
        activeCharts = [];
        fileInput.value = '';
        fileNameDisplay.innerHTML = 'Drag & Drop your file or <span style="color:var(--primary-color); text-decoration: underline;">Browse</span>';
        dropZone.style.boxShadow = '';
        analyzeBtn.disabled = true;
        reuploadBtn.style.display = 'none';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    uploadForm.onsubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(uploadForm);
        
        loadingDiv.style.display = 'block';
        resultsSection.style.display = 'none';
        analyzeBtn.disabled = true;

        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();

            if (data.success) {
                currentChartData = data.chart_data;
                renderResults(data);
            } else {
                alert('Error: ' + data.error);
            }
        } catch (err) {
            alert('Upload failed: ' + err.message);
        } finally {
            loadingDiv.style.display = 'none';
            analyzeBtn.disabled = false;
        }
    };

    function renderResults(data) {
        resultsSection.style.display = 'block';
        document.getElementById('current-filename').textContent = data.filename;
        updateStats(data.insights);

        // Populate Category Filter
        const catFilter = document.getElementById('category-filter');
        catFilter.innerHTML = '<option value="all">All Categories</option>';
        
        // Use first categorical column for now
        const firstCat = Object.keys(data.insights.categorical_values)[0];
        if (firstCat) {
            data.insights.categorical_values[firstCat].forEach(val => {
                const opt = document.createElement('option');
                opt.value = val;
                opt.textContent = val;
                catFilter.appendChild(opt);
            });
            catFilter.dataset.column = firstCat;
        }

        // Clear and render charts
        chartsContainer.innerHTML = '';
        activeCharts.forEach(c => c.destroy());
        activeCharts = [];

        currentChartData.forEach((chart, index) => {
            renderChart(chart, index);
        });

        // Trigger animation
        resultsSection.classList.add('animate-in');

        // Wire up Filters
        const applyBtn = document.getElementById('apply-filters');
        const resetBtn = document.getElementById('reset-filters');
        const searchInput = document.getElementById('search-filter');

        applyBtn.onclick = async () => {
            const filters = {};
            if (catFilter.value !== 'all') {
                filters[catFilter.dataset.column] = catFilter.value;
            }
            
            applyBtn.disabled = true;
            applyBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Filtering...';

            try {
                const res = await fetch('/filter-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filename: data.filename,
                        filters: filters,
                        search: searchInput.value
                    })
                });
                const filterResult = await res.json();
                if (filterResult.success) {
                    currentChartData = filterResult.chart_data;
                    updateStats(filterResult.insights);
                    chartsContainer.innerHTML = '';
                    activeCharts.forEach(c => c.destroy());
                    currentChartData.forEach((c, idx) => renderChart(c, idx));
                } else {
                    alert(filterResult.error || 'Filter failed');
                }
            } catch (err) {
                alert('Filter error');
            } finally {
                applyBtn.disabled = false;
                applyBtn.innerHTML = 'Apply Filters';
            }
        };

        resetBtn.onclick = () => {
            catFilter.value = 'all';
            searchInput.value = '';
            applyBtn.click();
        };

        // Export PDF Handler
        const exportBtn = document.getElementById('export-pdf-btn');
        exportBtn.onclick = async () => {
            exportBtn.disabled = true;
            exportBtn.textContent = 'Generating...';
            try {
                const response = await fetch('/export-pdf', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filename: data.filename,
                        insights: data.insights
                    })
                });
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const baseName = data.filename.split('.').slice(0, -1).join('.') || data.filename;
                a.download = `Report_${baseName}.pdf`;
                document.body.appendChild(a);
                a.click();
                a.remove();
            } catch (err) {
                alert('Export failed');
            } finally {
                exportBtn.disabled = false;
                exportBtn.textContent = 'Export Report (PDF)';
            }
        };
    }

    function updateStats(insights) {
        document.getElementById('row-count').textContent = insights.rows;
        document.getElementById('col-count').textContent = insights.columns;
        const totalMissing = Object.values(insights.missing_values).reduce((a, b) => a + b, 0);
        document.getElementById('missing-count').textContent = totalMissing;
    }

    function getChartColors(index, type) {
        const palettes = [
            { primary: '#56cd0c', secondary: 'rgba(86, 205, 12, 0.1)', multi: ['#56cd0c', '#4a90e2', '#ff6b6b', '#51cf66', '#fcc419', '#ff922b', '#845ef7'] },
            { primary: '#4a90e2', secondary: 'rgba(74, 144, 226, 0.1)', multi: ['#4a90e2', '#56cd0c', '#ff6b6b', '#ff922b', '#fcc419', '#845ef7', '#51cf66'] },
            { primary: '#ff6b6b', secondary: 'rgba(255, 107, 107, 0.1)', multi: ['#ff6b6b', '#fcc419', '#4a90e2', '#56cd0c', '#845ef7', '#51cf66', '#ff922b'] },
            { primary: '#fcc419', secondary: 'rgba(252, 196, 25, 0.1)', multi: ['#fcc419', '#ff922b', '#56cd0c', '#4a90e2', '#845ef7', '#ff6b6b', '#51cf66'] },
            { primary: '#845ef7', secondary: 'rgba(132, 94, 247, 0.1)', multi: ['#845ef7', '#ff6b6b', '#4a90e2', '#56cd0c', '#fcc419', '#51cf66', '#ff922b'] }
        ];

        const palette = palettes[index % palettes.length];
        
        if (['pie', 'doughnut'].includes(type)) {
            return { bg: palette.multi, border: 'transparent' };
        } else if (type === 'line') {
            return { bg: palette.secondary, border: palette.primary };
        } else {
            return { bg: palette.primary, border: 'transparent' };
        }
    }

    function renderChart(chart, index) {
        const wrapper = document.createElement('div');
        wrapper.className = 'card-inset chart-card animate-in';
        wrapper.style.animationDelay = `${index * 0.1}s`;
        
        const controls = document.createElement('div');
        controls.className = 'chart-controls';
        
        const types = [
            { id: 'bar', icon: 'fa-chart-bar' },
            { id: 'line', icon: 'fa-chart-line' },
            { id: 'pie', icon: 'fa-chart-pie' },
            { id: 'doughnut', icon: 'fa-circle-dot' },
            { id: 'scatter', icon: 'fa-braille' }
        ];

        types.forEach(t => {
            const btn = document.createElement('button');
            btn.className = `chart-toggle ${chart.type === t.id ? 'active' : ''}`;
            btn.innerHTML = `<i class="fa-solid ${t.icon}"></i>`;
            btn.onclick = () => updateChartType(index, t.id);
            controls.appendChild(btn);
        });

        const canvas = document.createElement('canvas');
        canvas.id = `chart-${index}`;
        
        wrapper.appendChild(controls);
        wrapper.appendChild(canvas);
        chartsContainer.appendChild(wrapper);

        const colors = getChartColors(index, chart.type);
        const ctx = canvas.getContext('2d');
        
        // Handle data format for scatter if it's not already in x/y format
        let chartData = chart.data;
        let chartLabels = chart.labels || [];

        if (chart.type === 'scatter') {
            if (chart.data.length > 0 && typeof chart.data[0] !== 'object') {
                chartData = chart.data.map((v, i) => ({ x: i, y: v }));
            }
        } else {
            if (chart.data.length > 0 && typeof chart.data[0] === 'object' && 'y' in chart.data[0]) {
                if (chartLabels.length === 0 && 'x' in chart.data[0]) {
                    chartLabels = chart.data.map(v => v.x);
                }
                chartData = chart.data.map(v => v.y);
            }
        }

        const newChart = new Chart(ctx, {
            type: ['pie', 'doughnut'].includes(chart.type) ? chart.type : (chart.type === 'scatter' ? 'scatter' : chart.type),
            data: {
                labels: chartLabels,
                datasets: [{
                    label: chart.title,
                    data: chartData,
                    backgroundColor: colors.bg,
                    borderColor: colors.border,
                    borderWidth: (chart.type === 'line' || chart.type === 'scatter') ? 3 : 0,
                    borderRadius: chart.type === 'bar' ? 8 : 0,
                    fill: chart.type === 'line',
                    tension: 0.4,
                    pointRadius: chart.type === 'scatter' ? 6 : 4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: ['pie', 'doughnut'].includes(chart.type) || chart.type === 'scatter', labels: { color: '#e8e6e3' } },
                    title: { display: true, text: chart.title, color: '#e8e6e3', font: { size: 16, weight: 'bold' } }
                },
                scales: ['pie', 'doughnut'].includes(chart.type) ? {} : {
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, border: { display: false }, ticks: { color: '#888' } },
                    x: { grid: { display: false }, border: { display: false }, ticks: { color: '#888' } }
                }
            }
        });
        activeCharts[index] = newChart;
    }

    function updateChartType(index, newType) {
        // Destroy and re-render only the specific chart
        const chartObj = currentChartData[index];
        chartObj.type = newType;
        
        const cards = document.querySelectorAll('.chart-card');
        const targetCard = cards[index];
        
        // Update toggles
        const btns = targetCard.querySelectorAll('.chart-toggle');
        btns.forEach(b => {
            b.classList.remove('active');
            const icon = b.querySelector('i');
            const iconClass = `fa-${newType === 'doughnut' ? 'circle-dot' : (newType === 'scatter' ? 'braille' : 'chart-' + newType)}`;
            if (icon.classList.contains(iconClass)) {
                b.classList.add('active');
            }
        });
        
        // Clear canvas
        const oldCanvas = targetCard.querySelector('canvas');
        const parent = oldCanvas.parentElement;
        oldCanvas.remove();
        
        const newCanvas = document.createElement('canvas');
        parent.appendChild(newCanvas);
        
        activeCharts[index].destroy();
        
        // Re-init chart with new type on new canvas
        renderChartOnCanvas(chartObj, index, newCanvas);
    }

    function renderChartOnCanvas(chart, index, canvas) {
        const colors = getChartColors(index, chart.type);
        const ctx = canvas.getContext('2d');
        
        // Handle data format for scatter if it's not already in x/y format
        let chartData = chart.data;
        let chartLabels = chart.labels || [];

        if (chart.type === 'scatter') {
            if (chart.data.length > 0 && typeof chart.data[0] !== 'object') {
                chartData = chart.data.map((v, i) => ({ x: i, y: v }));
            }
        } else {
            if (chart.data.length > 0 && typeof chart.data[0] === 'object' && 'y' in chart.data[0]) {
                if (chartLabels.length === 0 && 'x' in chart.data[0]) {
                    chartLabels = chart.data.map(v => v.x);
                }
                chartData = chart.data.map(v => v.y);
            }
        }

        const newChart = new Chart(ctx, {
            type: ['pie', 'doughnut'].includes(chart.type) ? chart.type : (chart.type === 'scatter' ? 'scatter' : chart.type),
            data: {
                labels: chartLabels,
                datasets: [{
                    label: chart.title,
                    data: chartData,
                    backgroundColor: colors.bg,
                    borderColor: colors.border,
                    borderWidth: (chart.type === 'line' || chart.type === 'scatter') ? 3 : 0,
                    borderRadius: chart.type === 'bar' ? 8 : 0,
                    fill: chart.type === 'line',
                    tension: 0.4,
                    pointRadius: chart.type === 'scatter' ? 6 : 4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: ['pie', 'doughnut'].includes(chart.type) || chart.type === 'scatter', labels: { color: '#e8e6e3' } },
                    title: { display: true, text: chart.title, color: '#e8e6e3', font: { size: 16, weight: 'bold' } }
                },
                scales: ['pie', 'doughnut'].includes(chart.type) ? {} : {
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, border: { display: false }, ticks: { color: '#888' } },
                    x: { grid: { display: false }, border: { display: false }, ticks: { color: '#888' } }
                }
            }
        });
        activeCharts[index] = newChart;
    }
});
