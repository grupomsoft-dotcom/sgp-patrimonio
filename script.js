const form = document.getElementById('formPatrimonio');
const listaTabela = document.getElementById('listaPatrimonio');
const contadorItens = document.getElementById('totalItens');
const CHAVE_STORAGE = 'sgp_patrimonio_igreja';

const editIdInput = document.getElementById('editId');
const btnSalvar = document.getElementById('btnSalvar');
const btnCancelar = document.getElementById('btnCancelar');
const tituloForm = document.getElementById('tituloForm');
const cardForm = document.getElementById('cardFormulario');

document.addEventListener('DOMContentLoaded', carregarSistema);

function buscarDadosBrutos() {
    return JSON.parse(localStorage.getItem(CHAVE_STORAGE)) || [];
}

function salvarDadosBrutos(dados) {
    try {
        localStorage.setItem(CHAVE_STORAGE, JSON.stringify(dados));
    } catch (e) {
        alert("Erro: Banco local cheio. Remova fotos antigas.");
    }
}

form.addEventListener('submit', processarFormulario);

async function processarFormulario(e) {
    e.preventDefault();
    btnSalvar.disabled = true;
    const inputFoto = document.getElementById('fotoItem');
    const idEdicao = editIdInput.value;
    let inventario = buscarDadosBrutos();
    let fotoBase64 = idEdicao ? (inventario.find(i => i.id == idEdicao).foto || "") : "";

    if (inputFoto.files && inputFoto.files[0]) {
        btnSalvar.innerText = "Processando foto...";
        fotoBase64 = await reduzirEMasterizarImagem(inputFoto.files[0]);
    }

    const dadosItem = {
        congregacao: document.getElementById('congregacao').value,
        nome: document.getElementById('nomeItem').value,
        valor: parseFloat(document.getElementById('valorItem').value),
        obs: document.getElementById('obsItem').value,
        foto: fotoBase64
    };

    if (idEdicao) {
        inventario = inventario.map(item => (item.id == idEdicao ? { ...item, ...dadosItem } : item));
        cancelarEdicao();
    } else {
        inventario.push({ id: Date.now(), ...dadosItem });
    }

    salvarDadosBrutos(inventario);
    form.reset();
    btnSalvar.disabled = false;
    btnSalvar.innerText = "Salvar no SGP";
    carregarSistema();
}

function prepararEdicao(id) {
    const item = buscarDadosBrutos().find(i => i.id == id);
    if (item) {
        editIdInput.value = item.id;
        document.getElementById('congregacao').value = item.congregacao;
        document.getElementById('nomeItem').value = item.nome;
        document.getElementById('valorItem').value = item.valor;
        document.getElementById('obsItem').value = item.obs || "";
        tituloForm.innerText = "Editando Item";
        btnSalvar.innerText = "Atualizar Item";
        btnSalvar.className = "btn btn-warning";
        btnCancelar.classList.remove('d-none');
        cardForm.classList.add('editando');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function cancelarEdicao() {
    editIdInput.value = "";
    tituloForm.innerText = "Cadastrar Novo Bem";
    btnSalvar.innerText = "Salvar no SGP";
    btnSalvar.className = "btn btn-success";
    btnCancelar.classList.add('d-none');
    cardForm.classList.remove('editando');
    form.reset();
}

function reduzirEMasterizarImagem(arquivo) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(arquivo);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX = 300;
                let w = img.width, h = img.height;
                if (w > h ? w > MAX : h > MAX) {
                    const r = MAX / (w > h ? w : h);
                    w *= r; h *= r;
                }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
    });
}

function carregarSistema() { renderizarTabela(buscarDadosBrutos()); }

function filtrarItens() {
    const busca = document.getElementById('buscaNome').value.toLowerCase();
    const congregacao = document.getElementById('filtroCongregacao').value;
    const filtrados = buscarDadosBrutos().filter(i => 
        (i.nome.toLowerCase().includes(busca) || (i.obs && i.obs.toLowerCase().includes(busca))) && 
        (congregacao === "" || i.congregacao === congregacao)
    );
    renderizarTabela(filtrados);
}

function renderizarTabela(dados) {
    listaTabela.innerHTML = '';
    dados.forEach(item => {
        const tr = document.createElement('tr');
        const foto = item.foto ? `<img src="${item.foto}" class="img-patrimonio">` : `<div class="img-patrimonio d-flex align-items-center justify-content-center text-muted">🖼️</div>`;
        tr.innerHTML = `<td>${foto}</td><td><strong>${item.nome}</strong><small class="obs-texto">${item.obs || ''}</small></td><td><span class="badge bg-secondary">${item.congregacao}</span></td><td>R$ ${item.valor.toFixed(2)}</td><td class="text-center"><button class="btn btn-outline-primary btn-sm me-1" onclick="prepararEdicao(${item.id})">Editar</button><button class="btn btn-outline-danger btn-sm" onclick="removerItem(${item.id})">X</button></td>`;
        listaTabela.appendChild(tr);
    });
    contadorItens.innerText = `${dados.length} itens encontrados`;
}

function removerItem(id) {
    if (confirm("Apagar item?")) {
        salvarDadosBrutos(buscarDadosBrutos().filter(i => i.id !== id));
        carregarSistema();
    }
}

// ========================================================
// FUNÇÕES DE BACKUP (JSON)
// ========================================================

function gerarBackup() {
    const dados = localStorage.getItem(CHAVE_STORAGE);
    if (!dados || dados === "[]") return alert("Não há dados para backup.");
    const blob = new Blob([dados], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_SGP_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`;
    a.click();
}

function restaurarBackup(input) {
    const arquivo = input.files[0];
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = (e) => {
        try {
            const dadosImportados = JSON.parse(e.target.result);
            if (confirm(`Deseja restaurar ${dadosImportados.length} itens? Isso substituirá os dados atuais!`)) {
                salvarDadosBrutos(dadosImportados);
                carregarSistema();
                alert("Backup restaurado com sucesso!");
            }
        } catch (err) {
            alert("Erro ao ler o arquivo de backup. Verifique se é um arquivo .json válido.");
        }
    };
    leitor.readAsText(arquivo);
}

function exportarExcel() {
    const dados = buscarDadosBrutos();
    let csv = "\ufeffNome;Observacao;Congregacao;Valor\n";
    dados.forEach(i => csv += `${i.nome};${i.obs || ''};${i.congregacao};${i.valor.toFixed(2)}\n`);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = "Relatorio_SGP.csv"; a.click();
}