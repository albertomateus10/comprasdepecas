/* ===== Registro do Plugin de Rótulos do Chart.js ===== */
if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
}

/* ===== Helpers UI & Formatação ===== */
function showError(msg) {
    const el = document.getElementById('alertError');
    if (!el) return;
    el.querySelector('.msg').textContent = msg;
    el.classList.add('show');
}

function showWarn(msg) {
    const el = document.getElementById('alertWarn');
    if (!el) return;
    el.querySelector('.msg').textContent = msg;
    el.classList.add('show');
}

const $ = s => document.querySelector(s);
const BRL = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(+v || 0);
const NUM = v => new Intl.NumberFormat('pt-BR').format(+v || 0);
const PCT = v => (Number.isFinite(v) ? v.toFixed(1).replace('.', ',') : '0,0') + '%';

function formatCompactBRL(v) {
    if (v >= 1000000) {
        return 'R$ ' + (v / 1000000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + ' M';
    }
    if (v >= 1000) {
        return 'R$ ' + (v / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' K';
    }
    return BRL(v);
}

function withStableScroll(fn) {
    const x = window.pageXOffset || 0;
    const y = window.pageYOffset || 0;
    fn();
    requestAnimationFrame(() => {
        window.scrollTo(x, y);
        requestAnimationFrame(() => { window.scrollTo(x, y); });
    });
}

function toNumberBR(x) {
    if (x === null || x === undefined || x === '') return 0;
    if (typeof x === 'number') return isNaN(x) ? 0 : x;
    const s = String(x).trim();
    const clean = s.replace(/[R$\s]/g, '').replace(/\./g, '').replace(/,/g, '.');
    const n = parseFloat(clean);
    return isNaN(n) ? 0 : n;
}

function parseDateExcel(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') {
        const base = new Date(Date.UTC(1899, 11, 30));
        return new Date(base.getTime() + v * 86400000);
    }
    if (typeof v === 'string') {
        const s = v.trim();
        const parts = s.split(/[\/\-]/);
        if (parts.length === 3) {
            if (parts[2].length === 4) {
                return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
            }
            if (parts[0].length === 4) {
                return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            }
        }
        const d = new Date(s);
        return isNaN(+d) ? null : d;
    }
    return null;
}

const NOMES_MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function formatMesAno(dateObj) {
    if (!dateObj || isNaN(+dateObj)) return 'Não informado';
    return `${NOMES_MESES[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
}

function sortMesAno(arr) {
    const nomes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    return [...arr].sort((a, b) => {
        if (!a || a === 'Não informado') return 1;
        if (!b || b === 'Não informado') return -1;
        const pa = String(a).toLowerCase().split(' ');
        const pb = String(b).toLowerCase().split(' ');
        const ya = parseInt(pa[1], 10) || 0;
        const yb = parseInt(pb[1], 10) || 0;
        if (ya !== yb) return ya - yb;
        const ma = nomes.indexOf(pa[0]);
        const mb = nomes.indexOf(pb[0]);
        return ma - mb;
    });
}

function formatCnpj(v) {
    if (!v) return '—';
    const s = String(v).trim();
    if (s.includes('/') || s.includes('.')) return s;
    const clean = s.replace(/\D/g, '');
    if (clean.length === 14) {
        return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }
    return s;
}

function getFaixaValor(val) {
    const v = +val || 0;
    if (v <= 500) return 'Até R$ 500';
    if (v <= 2000) return 'R$ 500 a R$ 2.000';
    if (v <= 10000) return 'R$ 2.000 a R$ 10.000';
    if (v <= 50000) return 'R$ 10.000 a R$ 50.000';
    return 'Acima de R$ 50.000';
}

const FAIXAS_VALOR_ORDEM = [
    'Até R$ 500',
    'R$ 500 a R$ 2.000',
    'R$ 2.000 a R$ 10.000',
    'R$ 10.000 a R$ 50.000',
    'Acima de R$ 50.000'
];

/* ===== Estado da Aplicação ===== */
let allData = [];
let filtered = [];
let charts = {
    periodo: null,
    topFornecedores: null,
    freqFornecedores: null,
    faixasValor: null
};

let periodoDateType = 'entrada'; // 'entrada' ou 'emissao'
let periodBarFilter = null;      // 'Janeiro 2026', etc.
let mainMetric = 'valor';        // 'valor' ou 'qtd'
let barFilter = null;            // { label: string }
let tableLoaded = false;
let currentPage = 1;
let pageSize = 50;

const state = {
    search: '',
    Periodo: [],
    Fornecedor: [],
    CNPJ: [],
    FaixaValor: [],
    Nota: []
};

const sortState = {
    key: 'valor',
    type: 'num',
    dir: 'desc'
};

/* ===== Componente de Pílula (MultiPill) ===== */
class MultiPill {
    constructor({ label, getter, setter }) {
        this.label = label;
        this.getter = getter;
        this.setter = setter;
        this.options = [];
        this.el = document.createElement('div');
        this.el.className = 'pill';
        this.el.tabIndex = 0;
        this.el.innerHTML = `<strong>${label}:</strong> <span class="value">Todos</span> <i class="fa-solid fa-chevron-down chev"></i><div class="menu"></div>`;
        this.menu = this.el.querySelector('.menu');
        this.valueEl = this.el.querySelector('.value');
        this.searchInput = null;

        this.el.addEventListener('click', e => {
            if (!e.target.closest('.menu')) {
                const x = window.pageXOffset, y = window.pageYOffset;
                this.el.classList.toggle('open');
                if (this.searchInput) this.searchInput.focus();
                window.scrollTo(x, y);
            }
        });

        document.addEventListener('click', e => {
            if (!this.el.contains(e.target)) {
                const x = window.pageXOffset, y = window.pageYOffset;
                this.el.classList.remove('open');
                window.scrollTo(x, y);
            }
        });
    }

    setOptions(opts, { keepOrder = false } = {}) {
        const unique = [...new Set(opts.filter(Boolean))];
        this.options = keepOrder ? unique : unique.sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
        this.render();
    }

    render() {
        const sel = new Set(this.getter());
        this.menu.innerHTML = '';

        const s = document.createElement('input');
        s.placeholder = `Pesquisar ${this.label.toLowerCase()}...`;
        s.className = 'menu-search';
        this.menu.append(s);
        this.searchInput = s;

        const acts = document.createElement('div');
        acts.className = 'menu-actions';
        const limpar = document.createElement('button');
        limpar.textContent = 'Limpar';
        const aplicar = document.createElement('button');
        aplicar.textContent = 'Aplicar';
        aplicar.className = 'apply';
        acts.append(limpar, aplicar);
        this.menu.append(acts);

        const list = document.createElement('div');
        list.className = 'list';
        this.menu.append(list);

        for (const o of this.options) {
            const row = document.createElement('label');
            row.className = 'opt';
            row.dataset.text = String(o).toLowerCase();
            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.value = o;
            chk.checked = sel.has(o);
            row.append(chk, document.createElement('span'));
            row.lastChild.textContent = o;
            list.append(row);
        }

        s.oninput = () => {
            const q = s.value.toLowerCase();
            list.querySelectorAll('.opt').forEach(el => {
                el.style.display = el.dataset.text.includes(q) ? '' : 'none';
            });
        };

        limpar.onclick = () => withStableScroll(() => {
            this.setter([]);
            this.sync();
            applyFilters();
        });

        aplicar.onclick = () => withStableScroll(() => {
            const vals = [...list.querySelectorAll('input:checked')].map(i => i.value);
            this.setter(vals);
            this.el.classList.remove('open');
            this.sync();
            applyFilters();
        });

        list.addEventListener('click', (ev) => {
            const input = ev.target.closest('input[type="checkbox"]');
            if (!input) return;
            const temp = new Set(this.getter());
            if (input.checked) temp.add(input.value); else temp.delete(input.value);
            const arr = [...temp];
            this.valueEl.textContent = !arr.length ? 'Todos' : (arr.length <= 2 ? arr.join(', ') : `${arr[0]}, ${arr[1]} (+${arr.length - 2})`);
        });

        this.sync();
    }

    sync() {
        const v = this.getter();
        this.valueEl.textContent = !v || v.length === 0 ? 'Todos' : (v.length <= 2 ? v.join(', ') : `${v[0]}, ${v[1]} (+${v.length - 2})`);
    }
}

const pillInstances = {
    Periodo: new MultiPill({ label: 'Período', getter: () => state.Periodo, setter: v => state.Periodo = v }),
    Fornecedor: new MultiPill({ label: 'Fornecedor', getter: () => state.Fornecedor, setter: v => state.Fornecedor = v }),
    CNPJ: new MultiPill({ label: 'CNPJ', getter: () => state.CNPJ, setter: v => state.CNPJ = v }),
    FaixaValor: new MultiPill({ label: 'Faixa de Valor', getter: () => state.FaixaValor, setter: v => state.FaixaValor = v }),
    Nota: new MultiPill({ label: 'Número da Nota', getter: () => state.Nota, setter: v => state.Nota = v })
};

(function mountPills() {
    const holder = document.getElementById('filters');
    if (!holder) return;
    ['Periodo', 'Fornecedor', 'CNPJ', 'FaixaValor', 'Nota'].forEach(k => {
        holder.appendChild(pillInstances[k].el);
    });
})();

/* ===== Upload e Leitura de Arquivo ===== */
const fileInput = document.getElementById('fileInput');
const fileNameEl = document.getElementById('fileName');

if (fileInput) {
    fileInput.addEventListener('change', ev => {
        const f = ev.target.files?.[0];
        if (f) {
            fileNameEl.textContent = f.name;
            readFile(f);
        }
    });
}

async function readFile(file) {
    try {
        if (!window.XLSX) {
            showError('Biblioteca XLSX não carregada. Verifique sua conexão com a internet.');
            return;
        }
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        if (!['xlsx', 'xls', 'csv'].includes(ext)) {
            showWarn('Formato não suportado. Por favor utilize um arquivo .xlsx, .xls ou .csv');
            return;
        }

        let wb;
        if (ext === 'csv') {
            const text = await file.text();
            wb = XLSX.read(text, { type: 'string' });
        } else {
            const buf = await file.arrayBuffer();
            wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
        }
        processWorkbook(wb);
    } catch (err) {
        console.error(err);
        showError('Falha ao ler o arquivo. Verifique se o arquivo não está corrompido ou protegido por senha.');
    }
}

function processWorkbook(wb) {
    const name = wb.SheetNames.find(n => {
        const ws = wb.Sheets[n];
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
        return (range.e.r - range.s.r) >= 1;
    }) || wb.SheetNames[0];

    const ws = wb.Sheets[name];
    if (!ws) {
        showError('A planilha selecionada está vazia.');
        return;
    }

    const mat = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
    if (!mat || !mat.length) {
        showError('Nenhuma linha de dados encontrada.');
        return;
    }

    let headerIdx = detectHeaderRow(mat);
    const headers = (mat[headerIdx] || []).map(x => String(x || '').trim());
    const dataRows = mat.slice(headerIdx + 1);

    parseRows(headers, dataRows);
}

function detectHeaderRow(mat) {
    let best = 0, bestIdx = 0;
    const maxCheck = Math.min(10, mat.length);
    for (let i = 0; i < maxCheck; i++) {
        const row = mat[i] || [];
        const filled = row.filter(c => c !== undefined && c !== null && String(c).trim() !== '').length;
        const hasText = row.some(c => typeof c === 'string' && c.trim().length > 0);
        if (hasText && filled > best) {
            best = filled;
            bestIdx = i;
        }
    }
    return bestIdx;
}

function findCol(headers, aliases) {
    const lc = headers.map(h => String(h || '').toLowerCase().trim());
    for (const a of aliases) {
        const idx = lc.indexOf(a.toLowerCase());
        if (idx >= 0) return idx;
    }
    return -1;
}

function parseRows(headers, data) {
    const colNota = (() => {
        const c = findCol(headers, ['Nota', 'Número da nota', 'Numero da Nota', 'NF', 'Num Nota', 'Documento']);
        return c >= 0 ? c : 0;
    })();

    const colFornecedor = (() => {
        const c = findCol(headers, ['Fornecedor', 'Nome do Fornecedor', 'Razão Social', 'Razao Social', 'Nome']);
        return c >= 0 ? c : 2;
    })();

    const colCnpj = (() => {
        const c = findCol(headers, ['Documento Fornecedor', 'CNPJ', 'CPF/CNPJ', 'CNPJ Fornecedor']);
        return c >= 0 ? c : 3;
    })();

    const colEmissao = (() => {
        const c = findCol(headers, ['Emissão', 'Emissao', 'Data Emissão', 'Data Emissao', 'Dt Emissao', 'EMISSÃO']);
        return c >= 0 ? c : 4;
    })();

    const colValor = (() => {
        const c = findCol(headers, ['Valor Nota', 'Valor', 'Valor Total', 'Total']);
        return c >= 0 ? c : 5;
    })();

    const colEntrada = (() => {
        const c = findCol(headers, ['Entrada', 'Data Entrada', 'Data de Entrada', 'Dt Entrada', 'ENTRADA']);
        return c >= 0 ? c : 6;
    })();

    allData = data.map((r, i) => {
        const rawNota = r[colNota];
        let notaStr = '';
        if (typeof rawNota === 'number' && Number.isInteger(rawNota)) {
            notaStr = String(rawNota);
        } else {
            notaStr = String(rawNota ?? '').trim();
        }

        const fornecedor = String(r[colFornecedor] ?? '').trim() || 'Fornecedor não identificado';
        const cnpj = String(r[colCnpj] ?? '').trim() || '—';
        const valor = toNumberBR(r[colValor]);

        const rawEnt = r[colEntrada];
        const dateEnt = parseDateExcel(rawEnt);
        const mesEnt = formatMesAno(dateEnt);

        const rawEmis = r[colEmissao];
        const dateEmis = parseDateExcel(rawEmis);
        const mesEmis = formatMesAno(dateEmis);

        return {
            id: i + 1,
            nota: notaStr || '—',
            fornecedor: fornecedor,
            cnpj: cnpj,
            valor: valor,
            faixaValor: getFaixaValor(valor),
            entrada: dateEnt ? dateEnt.toLocaleDateString('pt-BR') : '',
            emissao: dateEmis ? dateEmis.toLocaleDateString('pt-BR') : '',
            mesEntrada: mesEnt,
            mesEmissao: mesEmis,
            periodo: mesEnt !== 'Não informado' ? mesEnt : mesEmis
        };
    }).filter(r => r.fornecedor !== 'Fornecedor não identificado' || r.valor > 0);

    const badge = document.getElementById('badgeTotalGeral');
    if (badge) {
        badge.className = 'badge-tag success';
        badge.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${NUM(allData.length)} Notas Carregadas`;
    }

    const phTitle = document.getElementById('tablePlaceholderTitle');
    if (phTitle) phTitle.textContent = 'Tabela Otimizada para Máxima Performance';
    const phText = document.getElementById('tablePlaceholderText');
    if (phText) phText.innerHTML = 'Clique em <strong>qualquer barra dos gráficos acima</strong> para filtrar apenas as notas correspondentes àquele fornecedor/mês, ou clique no botão <strong>Carregar Tabela Completa</strong> para visualizar todos os registros.';

    initPillsAndApply();
}

function initPillsAndApply() {
    // Configura opções do filtro Período ordenadas cronologicamente
    const meses = allData.map(r => (periodoDateType === 'emissao' ? r.mesEmissao : r.mesEntrada) || r.periodo).filter(Boolean);
    const sortedMeses = sortMesAno([...new Set(meses)]);
    pillInstances.Periodo.setOptions(sortedMeses, { keepOrder: true });

    pillInstances.Fornecedor.setOptions(allData.map(x => x.fornecedor));
    pillInstances.CNPJ.setOptions(allData.map(x => x.cnpj));
    pillInstances.FaixaValor.setOptions(FAIXAS_VALOR_ORDEM, { keepOrder: true });
    pillInstances.Nota.setOptions(allData.map(x => x.nota));

    applyFilters();
}

/* ===== Alternar Tipo de Data do Período (Entrada / Emissão) ===== */
function setPeriodoDateType(type) {
    periodoDateType = type;
    const btnEnt = document.getElementById('btnPeriodoEntrada');
    const btnEmis = document.getElementById('btnPeriodoEmissao');
    const title = document.getElementById('periodoChartTitle');

    if (type === 'emissao') {
        btnEmis?.classList.add('active');
        btnEnt?.classList.remove('active');
        if (title) title.textContent = 'Compras por Período de Emissão (Mês)';
    } else {
        btnEnt?.classList.add('active');
        btnEmis?.classList.remove('active');
        if (title) title.textContent = 'Compras por Período de Entrada (Mês)';
    }

    const meses = allData.map(r => (type === 'emissao' ? r.mesEmissao : r.mesEntrada) || r.periodo).filter(Boolean);
    const sortedMeses = sortMesAno([...new Set(meses)]);
    pillInstances.Periodo.setOptions(sortedMeses, { keepOrder: true });

    withStableScroll(() => applyFilters());
}

/* ===== Busca Rápida e Limpeza ===== */
const qInput = document.getElementById('q');
if (qInput) {
    qInput.addEventListener('input', e => {
        state.search = e.target.value.toLowerCase().trim();
        withStableScroll(() => applyFilters());
    });
}

const clearAllBtn = document.getElementById('clearAll');
if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
        withStableScroll(() => {
            state.search = '';
            if (qInput) qInput.value = '';
            state.Periodo = [];
            state.Fornecedor = [];
            state.CNPJ = [];
            state.FaixaValor = [];
            state.Nota = [];
            barFilter = null;
            periodBarFilter = null;

            Object.values(pillInstances).forEach(p => {
                p.setter([]);
                p.render();
                p.sync();
            });

            updateBarFilterUI();
            updatePeriodBarFilterUI();
            applyFilters();
        });
    });
}

/* ===== Filtragem dos Dados ===== */
function applyFilters() {
    filtered = allData.filter(r => {
        const rowMes = (periodoDateType === 'emissao' ? r.mesEmissao : r.mesEntrada) || r.periodo;

        const periodoPillOk = state.Periodo.length === 0 || state.Periodo.includes(rowMes);
        const periodBarOk = !periodBarFilter || (rowMes === periodBarFilter);

        const fornOk = state.Fornecedor.length === 0 || state.Fornecedor.includes(r.fornecedor);
        const cnpjOk = state.CNPJ.length === 0 || state.CNPJ.includes(r.cnpj);
        const faixaOk = state.FaixaValor.length === 0 || state.FaixaValor.includes(r.faixaValor);
        const notaOk = state.Nota.length === 0 || state.Nota.includes(r.nota);

        let barOk = true;
        if (barFilter && barFilter.label) {
            barOk = (r.fornecedor === barFilter.label);
        }

        let searchOk = true;
        if (state.search) {
            const q = state.search;
            searchOk = r.fornecedor.toLowerCase().includes(q) ||
                       r.cnpj.toLowerCase().includes(q) ||
                       r.nota.toLowerCase().includes(q) ||
                       (r.entrada && r.entrada.toLowerCase().includes(q)) ||
                       (r.emissao && r.emissao.toLowerCase().includes(q));
        }

        return periodoPillOk && periodBarOk && fornOk && cnpjOk && faixaOk && notaOk && barOk && searchOk;
    });

    currentPage = 1;
    renderKpiGroups();
    renderCharts(filtered);
    renderTableSection();
}

/* ===== Renderização dos KPIs Executivos ===== */
function renderKpiGroups() {
    const kpiHolder = document.getElementById('kpiGroups');
    if (!kpiHolder) return;

    const totalValor = filtered.reduce((acc, r) => acc + r.valor, 0);
    const totalNotas = filtered.length;
    const ticketMedio = totalNotas ? totalValor / totalNotas : 0;

    const fornsUnicos = new Set(filtered.map(x => x.fornecedor));
    const cnpjsUnicos = new Set(filtered.map(x => x.cnpj).filter(c => c && c !== '—'));

    // Maior nota
    let maiorNota = { valor: 0, nota: '—', fornecedor: '—' };
    filtered.forEach(r => {
        if (r.valor > maiorNota.valor) {
            maiorNota = { valor: r.valor, nota: r.nota, fornecedor: r.fornecedor };
        }
    });

    // Fornecedor líder
    const fornAgg = {};
    filtered.forEach(r => {
        fornAgg[r.fornecedor] = (fornAgg[r.fornecedor] || 0) + r.valor;
    });
    const sortedForns = Object.entries(fornAgg).sort((a, b) => b[1] - a[1]);
    const top1 = sortedForns[0] || ['Nenhum', 0];
    const top1Share = totalValor > 0 ? (top1[1] / totalValor) * 100 : 0;

    // Concentração Top 30
    const top30Sum = sortedForns.slice(0, 30).reduce((acc, x) => acc + x[1], 0);
    const top30Share = totalValor > 0 ? (top30Sum / totalValor) * 100 : 0;

    kpiHolder.innerHTML = `
        <!-- Grupo 1: Visão Financeira e Volume -->
        <div class="kpi-group">
            <div class="title"><i class="fa-solid fa-coins"></i> Indicadores Financeiros & Volume</div>
            <div class="kpi-grid">
                <div class="kpi">
                    <div class="lab">Valor Total das Compras</div>
                    <div class="val">${BRL(totalValor)}</div>
                    <div class="sub">Soma de todas as notas do período</div>
                </div>
                <div class="kpi">
                    <div class="lab">Total de Notas Fiscais</div>
                    <div class="val" style="color: #2563eb;">${NUM(totalNotas)}</div>
                    <div class="sub">Documentos de entrada processados</div>
                </div>
                <div class="kpi">
                    <div class="lab">Ticket Médio por Nota</div>
                    <div class="val" style="color: var(--ok);">${BRL(ticketMedio)}</div>
                    <div class="sub">Média financeira por nota emitida</div>
                </div>
                <div class="kpi">
                    <div class="lab">Maior Compra / Nota</div>
                    <div class="val" style="color: #6366f1;">${BRL(maiorNota.valor)}</div>
                    <div class="sub" title="${maiorNota.fornecedor}">NF ${maiorNota.nota} • <strong>${maiorNota.fornecedor.slice(0, 22)}${maiorNota.fornecedor.length > 22 ? '...' : ''}</strong></div>
                </div>
            </div>
        </div>

        <!-- Grupo 2: Fornecedores e Concentração de Mercado -->
        <div class="kpi-group">
            <div class="title"><i class="fa-solid fa-handshake"></i> Fornecedores & Concentração</div>
            <div class="kpi-grid">
                <div class="kpi">
                    <div class="lab">Fornecedores Ativos</div>
                    <div class="val" style="color: #0284c7;">${NUM(fornsUnicos.size)}</div>
                    <div class="sub">Empresas parceiras distintas</div>
                </div>
                <div class="kpi">
                    <div class="lab">CNPJs Cadastrados</div>
                    <div class="val" style="color: #475569;">${NUM(cnpjsUnicos.size)}</div>
                    <div class="sub">Inscrições fiscais auditadas</div>
                </div>
                <div class="kpi">
                    <div class="lab">Fornecedor Líder</div>
                    <div class="val" style="font-size: 1.35rem; color: #7c3aed;" title="${top1[0]}">${BRL(top1[1])}</div>
                    <div class="sub" title="${top1[0]}"><strong>${top1[0].slice(0, 20)}${top1[0].length > 20 ? '...' : ''}</strong> (${PCT(top1Share)})</div>
                </div>
                <div class="kpi">
                    <div class="lab">Concentração Top 30</div>
                    <div class="val" style="color: #d97706;">${PCT(top30Share)}</div>
                    <div class="sub">${BRL(top30Sum)} nas 30 maiores empresas</div>
                </div>
            </div>
        </div>
    `;

    // Atualiza badge de total
    const badgeBadge = document.getElementById('mainChartTotalBadge');
    if (badgeBadge) {
        badgeBadge.textContent = `Total Filtrado: ${BRL(totalValor)}`;
    }
}

/* ===== Alternar Métrica do Gráfico Principal ===== */
function setMainChartMetric(metric) {
    mainMetric = metric;
    const btnV = document.getElementById('btnViewValor');
    const btnQ = document.getElementById('btnViewQtd');
    const titleText = document.getElementById('mainChartTitleText');

    if (metric === 'valor') {
        btnV?.classList.add('active');
        btnQ?.classList.remove('active');
        if (titleText) titleText.textContent = 'Ranking dos 30 Maiores Fornecedores por Valor Total (R$)';
    } else {
        btnQ?.classList.add('active');
        btnV?.classList.remove('active');
        if (titleText) titleText.textContent = 'Ranking dos 30 Maiores Fornecedores por Volume de Notas';
    }

    renderMainChart(filtered);
}

/* ===== Filtros por Clique em Barras ===== */
function onChartBarClick(evt, elements, chartInstance) {
    if (!elements || !elements.length) return;
    const idx = elements[0].index;
    const label = chartInstance.data.labels[idx];
    if (!label) return;

    if (barFilter && barFilter.label === label) {
        barFilter = null;
    } else {
        barFilter = { label: label };
    }

    updateBarFilterUI();
    withStableScroll(() => applyFilters());

    if (!tableLoaded) {
        toggleTableVisibility(true);
    }
}

function updateBarFilterUI() {
    const chip = document.getElementById('barFilterChip');
    const clearBarBtn = document.getElementById('clearBarFilterBtn');

    if (barFilter && barFilter.label) {
        if (chip) {
            chip.style.display = 'inline-flex';
            chip.innerHTML = `<i class="fa-solid fa-filter"></i> Fornecedor: <strong>${barFilter.label}</strong>`;
        }
        if (clearBarBtn) clearBarBtn.style.display = 'inline-flex';
    } else {
        if (chip) chip.style.display = 'none';
        if (clearBarBtn) clearBarBtn.style.display = 'none';
    }
}

function updatePeriodBarFilterUI() {
    const chip = document.getElementById('periodBarFilterChip');
    const clearBtn = document.getElementById('clearPeriodBarFilterBtn');

    if (periodBarFilter) {
        if (chip) {
            chip.style.display = 'inline-flex';
            chip.innerHTML = `<i class="fa-solid fa-calendar-check"></i> Período: <strong>${periodBarFilter}</strong>`;
        }
        if (clearBtn) clearBtn.style.display = 'inline-flex';
    } else {
        if (chip) chip.style.display = 'none';
        if (clearBtn) clearBtn.style.display = 'none';
    }
}

const clearBarFilterBtn = document.getElementById('clearBarFilterBtn');
if (clearBarFilterBtn) {
    clearBarFilterBtn.addEventListener('click', () => {
        barFilter = null;
        updateBarFilterUI();
        withStableScroll(() => applyFilters());
    });
}

const clearPeriodBarFilterBtn = document.getElementById('clearPeriodBarFilterBtn');
if (clearPeriodBarFilterBtn) {
    clearPeriodBarFilterBtn.addEventListener('click', () => {
        periodBarFilter = null;
        updatePeriodBarFilterUI();
        withStableScroll(() => applyFilters());
    });
}

/* ===== Renderização de Todos os Gráficos ===== */
function renderCharts(rows) {
    renderPeriodoChart(rows);
    renderMainChart(rows);
    renderSideFrequencyChart(rows);
    renderFaixasValorChart(rows);
}

/* 0. Gráfico de Compras por Período (Barras Verdes com Linha de Média) */
function renderPeriodoChart(rows) {
    const ctx = document.getElementById('periodoChart')?.getContext('2d');
    if (!ctx) return;

    // Agrupa compras por período conforme tipo de data selecionado
    const statsByPeriod = {};
    rows.forEach(r => {
        const mesKey = (periodoDateType === 'emissao' ? r.mesEmissao : r.mesEntrada) || r.periodo || 'Não informado';
        if (!statsByPeriod[mesKey]) {
            statsByPeriod[mesKey] = { valor: 0, qtd: 0 };
        }
        statsByPeriod[mesKey].valor += r.valor;
        statsByPeriod[mesKey].qtd += 1;
    });

    const sortedEntries = Object.entries(statsByPeriod).sort((a, b) => {
        if (!a[0] || a[0] === 'Não informado') return 1;
        if (!b[0] || b[0] === 'Não informado') return -1;
        const nomes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
        const pa = String(a[0]).toLowerCase().split(' ');
        const pb = String(b[0]).toLowerCase().split(' ');
        const ya = parseInt(pa[1], 10) || 0;
        const yb = parseInt(pb[1], 10) || 0;
        if (ya !== yb) return ya - yb;
        const ma = nomes.indexOf(pa[0]);
        const mb = nomes.indexOf(pb[0]);
        return ma - mb;
    });

    const labels = sortedEntries.map(x => x[0]);
    const values = sortedEntries.map(x => x[1].valor);
    const avgValor = values.length ? (values.reduce((a, b) => a + b, 0) / values.length) : 0;

    // Atualiza badge de média no topo do card
    const mediaBadge = document.getElementById('periodoChartMediaBadge');
    if (mediaBadge) {
        mediaBadge.textContent = `Média Mensal: ${BRL(avgValor)}`;
    }

    if (charts.periodo) {
        charts.periodo.destroy();
    }

    charts.periodo = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Compras no Período (R$)',
                    data: values,
                    backgroundColor: sortedEntries.map(x => {
                        if (periodBarFilter && periodBarFilter === x[0]) {
                            return '#047857'; // Verde escuro para barra clicada/ativa
                        }
                        return '#10b981'; // Verde solicitado
                    }),
                    hoverBackgroundColor: '#059669',
                    borderRadius: 8,
                    barPercentage: 0.52,
                    categoryPercentage: 0.8,
                    order: 2,
                    datalabels: {
                        display: true,
                        anchor: 'end',
                        align: 'end',
                        offset: 4,
                        color: '#065f46',
                        font: { weight: '800', size: 11 },
                        formatter: v => formatCompactBRL(v)
                    }
                },
                {
                    label: `Média Mensal: ${BRL(avgValor)}`,
                    type: 'line',
                    data: labels.map(() => avgValor),
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    borderWidth: 2.5,
                    borderDash: [8, 4],
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: '#ef4444',
                    order: 1,
                    datalabels: { display: false }
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 250 },
            onClick: (evt, elements) => {
                if (!elements || !elements.length) return;
                const idx = elements[0].index;
                const mesClicked = labels[idx];
                if (!mesClicked) return;

                if (periodBarFilter === mesClicked) {
                    periodBarFilter = null;
                } else {
                    periodBarFilter = mesClicked;
                }
                updatePeriodBarFilterUI();
                withStableScroll(() => applyFilters());

                if (!tableLoaded) {
                    toggleTableVisibility(true);
                }
            },
            scales: {
                y: {
                    grace: '20%',
                    beginAtZero: true,
                    grid: { color: '#f1f5f9' },
                    ticks: {
                        callback: v => formatCompactBRL(v),
                        font: { size: 11, weight: '600' },
                        color: '#64748b'
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 11, weight: '700' },
                        color: '#1e293b'
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        generateLabels: (chart) => {
                            const gen = Chart.defaults.plugins.legend.labels.generateLabels(chart);
                            return gen.map(l => {
                                if (l.datasetIndex === 1) {
                                    l.fillStyle = 'transparent';
                                    l.strokeStyle = '#ef4444';
                                    l.lineWidth = 2.5;
                                    l.lineDash = [8, 4];
                                }
                                return l;
                            });
                        }
                    }
                },
                tooltip: {
                    backgroundColor: '#0f172a',
                    titleFont: { size: 13, weight: 'bold' },
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        title: (items) => items[0]?.label || '',
                        label: (context) => {
                            if (context.datasetIndex === 1) {
                                return `Média Mensal: ${BRL(avgValor)}`;
                            }
                            const mesName = context.label;
                            const s = statsByPeriod[mesName] || { valor: 0, qtd: 0 };
                            const avgTicket = s.qtd ? (s.valor / s.qtd) : 0;
                            return [
                                `Compras no Mês: ${BRL(s.valor)}`,
                                `Volume de Notas: ${NUM(s.qtd)} notas`,
                                `Ticket Médio: ${BRL(avgTicket)}`,
                                `Média do Período: ${BRL(avgValor)}`
                            ];
                        }
                    }
                }
            }
        }
    });
}

/* 1. Gráfico Principal: Top 20 Maiores Fornecedores (Barras Horizontais / Lado a Lado) */
function renderMainChart(rows) {
    const ctx = document.getElementById('topFornecedoresChart')?.getContext('2d');
    if (!ctx) return;

    const agg = {};
    const totalGeralValor = rows.reduce((acc, r) => acc + r.valor, 0);

    rows.forEach(r => {
        if (!agg[r.fornecedor]) {
            agg[r.fornecedor] = { valor: 0, qtd: 0, cnpj: r.cnpj };
        }
        agg[r.fornecedor].valor += r.valor;
        agg[r.fornecedor].qtd += 1;
    });

    const isValor = (mainMetric === 'valor');
    const sorted = Object.entries(agg)
        .sort((a, b) => isValor ? (b[1].valor - a[1].valor) : (b[1].qtd - a[1].qtd))
        .slice(0, 30);

    const labels = sorted.map(x => x[0]);
    const dataValues = sorted.map(x => isValor ? x[1].valor : x[1].qtd);

    const backgroundColors = sorted.map((_, i) => {
        if (barFilter && barFilter.label) {
            return sorted[i][0] === barFilter.label ? '#1e40af' : '#cbd5e1';
        }
        const opacity = Math.max(0.45, 1 - (i * 0.025));
        return `rgba(37, 99, 235, ${opacity})`;
    });

    if (charts.topFornecedores) {
        charts.topFornecedores.destroy();
    }

    charts.topFornecedores = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: isValor ? 'Valor Comprado (R$)' : 'Quantidade de Notas',
                data: dataValues,
                backgroundColor: backgroundColors,
                borderRadius: 6,
                barPercentage: 0.78,
                categoryPercentage: 0.88,
                borderWidth: 0
            }]
        },
        options: {
            indexAxis: 'y', // Barras horizontais de lado a lado
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 250 },
            onClick: (evt, elements) => onChartBarClick(evt, elements, charts.topFornecedores),
            scales: {
                x: {
                    grace: '25%',
                    grid: { color: '#f1f5f9' },
                    ticks: {
                        callback: v => isValor ? formatCompactBRL(v) : NUM(v),
                        font: { size: 11, weight: '600' },
                        color: '#64748b'
                    }
                },
                y: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 11, weight: '700' },
                        color: '#1e293b',
                        callback: function(val) {
                            const lbl = this.getLabelForValue(val) || '';
                            return lbl.length > 32 ? lbl.slice(0, 30) + '…' : lbl;
                        }
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0f172a',
                    titleFont: { size: 13, weight: 'bold' },
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        title: (items) => items[0]?.label || '',
                        label: (context) => {
                            const fornName = context.label;
                            const d = agg[fornName] || { valor: 0, qtd: 0, cnpj: '—' };
                            const share = totalGeralValor > 0 ? (d.valor / totalGeralValor) * 100 : 0;
                            const ticketMedio = d.qtd ? (d.valor / d.qtd) : 0;

                            return [
                                `CNPJ: ${formatCnpj(d.cnpj)}`,
                                `Valor Total: ${BRL(d.valor)}`,
                                `Participação: ${PCT(share)}`,
                                `Volume de Notas: ${NUM(d.qtd)} notas`,
                                `Ticket Médio: ${BRL(ticketMedio)}`
                            ];
                        }
                    }
                },
                datalabels: {
                    display: true,
                    align: 'end',
                    anchor: 'end',
                    offset: 6,
                    clip: false,
                    color: '#1e40af',
                    font: { weight: '800', size: 11 },
                    formatter: (v) => isValor ? BRL(v) : NUM(v) + ' notas'
                }
            }
        }
    });
}

/* 2. Gráfico Lado a Lado: Frequência de Compras (Top Fornecedores por Qtd de Notas) */
function renderSideFrequencyChart(rows) {
    const ctx = document.getElementById('freqFornecedoresChart')?.getContext('2d');
    if (!ctx) return;

    const agg = {};
    rows.forEach(r => {
        if (!agg[r.fornecedor]) {
            agg[r.fornecedor] = { qtd: 0, valor: 0 };
        }
        agg[r.fornecedor].qtd += 1;
        agg[r.fornecedor].valor += r.valor;
    });

    const sorted = Object.entries(agg)
        .sort((a, b) => b[1].qtd - a[1].qtd)
        .slice(0, 15);

    const labels = sorted.map(x => x[0]);
    const values = sorted.map(x => x[1].qtd);

    if (charts.freqFornecedores) {
        charts.freqFornecedores.destroy();
    }

    charts.freqFornecedores = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Notas Emitidas',
                data: values,
                backgroundColor: '#0284c7',
                borderRadius: 6,
                barPercentage: 0.75
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            onClick: (evt, elements) => onChartBarClick(evt, elements, charts.freqFornecedores),
            scales: {
                x: {
                    grace: '20%',
                    grid: { color: '#f1f5f9' },
                    ticks: { font: { size: 11 } }
                },
                y: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 10, weight: '600' },
                        callback: function(val) {
                            const lbl = this.getLabelForValue(val) || '';
                            return lbl.length > 24 ? lbl.slice(0, 22) + '…' : lbl;
                        }
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (c) => {
                            const forn = c.label;
                            const d = agg[forn] || { qtd: 0, valor: 0 };
                            return [
                                `Quantidade: ${NUM(d.qtd)} notas`,
                                `Total: ${BRL(d.valor)}`
                            ];
                        }
                    }
                },
                datalabels: {
                    display: true,
                    align: 'end',
                    anchor: 'end',
                    offset: 4,
                    color: '#0369a1',
                    font: { weight: 'bold', size: 10 },
                    formatter: v => NUM(v)
                }
            }
        }
    });
}

/* 3. Gráfico Lado a Lado: Distribuição das Compras por Faixa de Valor */
function renderFaixasValorChart(rows) {
    const ctx = document.getElementById('faixasValorChart')?.getContext('2d');
    if (!ctx) return;

    const agg = {};
    FAIXAS_VALOR_ORDEM.forEach(f => {
        agg[f] = { valor: 0, qtd: 0 };
    });

    rows.forEach(r => {
        const f = r.faixaValor;
        if (agg[f]) {
            agg[f].valor += r.valor;
            agg[f].qtd += 1;
        }
    });

    const labels = FAIXAS_VALOR_ORDEM;
    const valorValues = labels.map(l => agg[l].valor);

    if (charts.faixasValor) {
        charts.faixasValor.destroy();
    }

    charts.faixasValor = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Valor Total (R$)',
                data: valorValues,
                backgroundColor: [
                    '#38bdf8',
                    '#3b82f6',
                    '#6366f1',
                    '#8b5cf6',
                    '#d946ef'
                ],
                borderRadius: 8,
                barPercentage: 0.65
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                y: {
                    grace: '20%',
                    grid: { color: '#f1f5f9' },
                    ticks: {
                        callback: v => formatCompactBRL(v),
                        font: { size: 11 }
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 10, weight: '600' } }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (c) => {
                            const f = c.label;
                            const d = agg[f] || { valor: 0, qtd: 0 };
                            return [
                                `Montante: ${BRL(d.valor)}`,
                                `Notas: ${NUM(d.qtd)} notas`
                            ];
                        }
                    }
                },
                datalabels: {
                    display: true,
                    align: 'end',
                    anchor: 'end',
                    offset: 4,
                    color: '#1e293b',
                    font: { weight: 'bold', size: 10 },
                    formatter: v => formatCompactBRL(v)
                }
            }
        }
    });
}

/* ===== Tabela sob Demanda ===== */
const toggleTableBtn = document.getElementById('toggleTableBtn');
const tablePlaceholder = document.getElementById('tablePlaceholder');
const gridWrap = document.getElementById('gridWrap');

function toggleTableVisibility(forceOpen = null) {
    if (forceOpen !== null) {
        tableLoaded = forceOpen;
    } else {
        tableLoaded = !tableLoaded;
    }

    if (tableLoaded) {
        if (tablePlaceholder) tablePlaceholder.style.display = 'none';
        if (gridWrap) gridWrap.style.display = 'block';
        if (toggleTableBtn) {
            toggleTableBtn.innerHTML = '<i class="fa-solid fa-folder-closed"></i> Ocultar Tabela';
        }
        renderTableSection();
    } else {
        if (tablePlaceholder) tablePlaceholder.style.display = 'block';
        if (gridWrap) gridWrap.style.display = 'none';
        if (toggleTableBtn) {
            toggleTableBtn.innerHTML = '<i class="fa-solid fa-folder-open"></i> Carregar Tabela Completa';
        }
    }
}

if (toggleTableBtn) {
    toggleTableBtn.addEventListener('click', () => toggleTableVisibility());
}

function renderTableSection() {
    if (!tableLoaded) return;

    const totalFiltradoValor = filtered.reduce((acc, r) => acc + r.valor, 0);

    const sorted = [...filtered].sort((a, b) => {
        let va = a[sortState.key];
        let vb = b[sortState.key];

        if (sortState.key === 'share') {
            va = totalFiltradoValor > 0 ? (a.valor / totalFiltradoValor) : 0;
            vb = totalFiltradoValor > 0 ? (b.valor / totalFiltradoValor) : 0;
        }

        if (sortState.type === 'num') {
            va = +va || 0;
            vb = +vb || 0;
            return sortState.dir === 'asc' ? va - vb : vb - va;
        } else {
            va = String(va || '').toLowerCase();
            vb = String(vb || '').toLowerCase();
            return sortState.dir === 'asc' ? va.localeCompare(vb, 'pt-BR') : vb.localeCompare(va, 'pt-BR');
        }
    });

    const totalItems = sorted.length;
    const totalPages = pageSize === Infinity ? 1 : Math.ceil(totalItems / pageSize);
    currentPage = Math.max(1, Math.min(currentPage, totalPages || 1));

    const startIdx = pageSize === Infinity ? 0 : (currentPage - 1) * pageSize;
    const endIdx = pageSize === Infinity ? totalItems : Math.min(startIdx + pageSize, totalItems);
    const pageRows = sorted.slice(startIdx, endIdx);

    const tbody = document.querySelector('#grid tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!pageRows.length) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 28px; color: #64748b; font-weight: 600;">Nenhum registro encontrado para os filtros selecionados.</td></tr>`;
    } else {
        const frag = document.createDocumentFragment();
        pageRows.forEach(r => {
            const tr = document.createElement('tr');
            const share = totalFiltradoValor > 0 ? (r.valor / totalFiltradoValor) * 100 : 0;

            tr.innerHTML = `
                <td class="cell-nota">${r.nota}</td>
                <td class="cell-fornecedor" title="Clique para filtrar apenas este fornecedor">${r.fornecedor}</td>
                <td class="cell-cnpj">${formatCnpj(r.cnpj)}</td>
                <td class="cell-valor">${BRL(r.valor)}</td>
                <td class="cell-share">${PCT(share)}</td>
            `;

            tr.querySelector('.cell-fornecedor').addEventListener('click', () => {
                toggleSupplierFilter(r.fornecedor);
            });

            frag.appendChild(tr);
        });
        tbody.appendChild(frag);
    }

    const tfootNotas = document.getElementById('tfootTotalNotas');
    const tfootForns = document.getElementById('tfootTotalFornecedores');
    const tfootValor = document.getElementById('tfootTotalValor');

    const uniqueForns = new Set(filtered.map(x => x.fornecedor)).size;
    if (tfootNotas) tfootNotas.textContent = `Total: ${NUM(totalItems)} notas`;
    if (tfootForns) tfootForns.textContent = `${NUM(uniqueForns)} fornecedores distintos`;
    if (tfootValor) tfootValor.textContent = BRL(totalFiltradoValor);

    renderPagination(totalItems, totalPages);
}

function toggleSupplierFilter(forn) {
    const set = new Set(state.Fornecedor);
    if (set.has(forn)) {
        set.delete(forn);
    } else {
        set.add(forn);
    }
    state.Fornecedor = [...set];
    pillInstances.Fornecedor.sync();
    withStableScroll(() => applyFilters());
}

/* ===== Ordenação por Cabeçalho de Coluna ===== */
document.querySelectorAll('#grid thead th.sortable').forEach(th => {
    th.addEventListener('click', () => {
        const key = th.dataset.key;
        const type = th.dataset.type || 'text';

        if (sortState.key === key) {
            sortState.dir = (sortState.dir === 'asc') ? 'desc' : 'asc';
        } else {
            sortState.key = key;
            sortState.type = type;
            sortState.dir = (key === 'valor' || key === 'share' || key === 'nota') ? 'desc' : 'asc';
        }

        document.querySelectorAll('#grid thead th.sortable').forEach(el => {
            el.classList.remove('active');
            const icon = el.querySelector('.sort');
            if (icon) icon.className = 'fa-solid fa-sort sort';
        });

        th.classList.add('active');
        const icon = th.querySelector('.sort');
        if (icon) {
            icon.className = `fa-solid fa-sort-${sortState.dir === 'asc' ? 'up' : 'down'} sort`;
        }

        renderTableSection();
    });
});

/* ===== Paginação ===== */
function renderPagination(totalItems, totalPages) {
    const holder = document.getElementById('tablePagination');
    if (!holder) return;

    if (!totalItems) {
        holder.innerHTML = '';
        return;
    }

    const start = (pageSize === Infinity) ? 1 : (currentPage - 1) * pageSize + 1;
    const end = (pageSize === Infinity) ? totalItems : Math.min(currentPage * pageSize, totalItems);

    holder.innerHTML = `
        <div class="pagination-info">
            Mostrando <strong>${NUM(start)}</strong> a <strong>${NUM(end)}</strong> de <strong>${NUM(totalItems)}</strong> notas
        </div>
        <div class="page-size-selector">
            <span>Itens por página:</span>
            <select id="pageSizeSelect">
                <option value="25" ${pageSize === 25 ? 'selected' : ''}>25</option>
                <option value="50" ${pageSize === 50 ? 'selected' : ''}>50</option>
                <option value="100" ${pageSize === 100 ? 'selected' : ''}>100</option>
                <option value="250" ${pageSize === 250 ? 'selected' : ''}>250</option>
                <option value="all" ${pageSize === Infinity ? 'selected' : ''}>Todas</option>
            </select>
        </div>
        <div class="pagination-controls">
            <button class="pagination-btn" id="btnFirstPage" ${currentPage === 1 ? 'disabled' : ''}>
                <i class="fa-solid fa-angles-left"></i>
            </button>
            <button class="pagination-btn" id="btnPrevPage" ${currentPage === 1 ? 'disabled' : ''}>
                <i class="fa-solid fa-chevron-left"></i> Anterior
            </button>
            <span style="padding: 0 8px; font-weight: 700;">${currentPage} / ${totalPages || 1}</span>
            <button class="pagination-btn" id="btnNextPage" ${currentPage >= totalPages ? 'disabled' : ''}>
                Próximo <i class="fa-solid fa-chevron-right"></i>
            </button>
            <button class="pagination-btn" id="btnLastPage" ${currentPage >= totalPages ? 'disabled' : ''}>
                <i class="fa-solid fa-angles-right"></i>
            </button>
        </div>
    `;

    document.getElementById('pageSizeSelect')?.addEventListener('change', e => {
        const val = e.target.value;
        pageSize = (val === 'all') ? Infinity : parseInt(val, 10);
        currentPage = 1;
        renderTableSection();
    });

    document.getElementById('btnFirstPage')?.addEventListener('click', () => {
        if (currentPage > 1) { currentPage = 1; renderTableSection(); }
    });
    document.getElementById('btnPrevPage')?.addEventListener('click', () => {
        if (currentPage > 1) { currentPage--; renderTableSection(); }
    });
    document.getElementById('btnNextPage')?.addEventListener('click', () => {
        if (currentPage < totalPages) { currentPage++; renderTableSection(); }
    });
    document.getElementById('btnLastPage')?.addEventListener('click', () => {
        if (currentPage < totalPages) { currentPage = totalPages; renderTableSection(); }
    });
}

/* ===== Exportação de Dados para CSV ===== */
const exportCsvBtn = document.getElementById('exportCsvBtn');
if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
        if (!filtered || !filtered.length) {
            showWarn('Nenhum dado disponível para exportação.');
            return;
        }

        const headers = ['Número da Nota', 'Nome do Fornecedor', 'CNPJ', 'Valor (R$)', 'Data Entrada', 'Data Emissão', 'Faixa de Valor'];
        const csvRows = [headers.join(';')];

        filtered.forEach(r => {
            const row = [
                `"${r.nota}"`,
                `"${r.fornecedor.replace(/"/g, '""')}"`,
                `"${formatCnpj(r.cnpj)}"`,
                r.valor.toFixed(2).replace('.', ','),
                `"${r.entrada || ''}"`,
                `"${r.emissao || ''}"`,
                `"${r.faixaValor}"`
            ];
            csvRows.push(row.join(';'));
        });

        const csvString = '\uFEFF' + csvRows.join('\r\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `compras_filtradas_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
}

/* ===== Inicialização Limpa ===== */
window.addEventListener('DOMContentLoaded', () => {
    // Inicializa a aplicação limpa, aguardando o usuário selecionar o arquivo
    allData = [];
    filtered = [];
    renderKpiGroups();
    renderCharts([]);

    // Suporte a arrastar e soltar arquivo diretamente na tela
    window.addEventListener('dragover', e => { e.preventDefault(); });
    window.addEventListener('drop', e => {
        e.preventDefault();
        const f = e.dataTransfer?.files?.[0];
        if (f) {
            if (fileNameEl) fileNameEl.textContent = f.name;
            readFile(f);
        }
    });
});
