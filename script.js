import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-auth.js";
import { getDatabase, ref, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-database.js";

// --- CONFIGURAÇÃO (COLE O SEU AQUI) ---
const firebaseConfig = {
  apiKey: "AIzaSyArcKb1bIOr-QYzirMr6c4VFk1_QC14REk",
  authDomain: "sgp-igreja.firebaseapp.com",
  databaseURL: "https://sgp-igreja-default-rtdb.firebaseio.com",
  projectId: "sgp-igreja",
  storageBucket: "sgp-igreja.firebasestorage.app",
  messagingSenderId: "208251232334",
  appId: "1:208251232334:web:0c857d289b755921be231f",
  measurementId: "G-5JF6T4BX74"

};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Referências
const patRef = ref(db, 'patrimonio');
const congRef = ref(db, 'congregacoes');

let dadosPatrimonio = [];
let dadosCongregacoes = [];

// --- MONITOR DE AUTENTICAÇÃO ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('telaLogin').style.display = 'none';
        document.getElementById('sistemaConteudo').style.display = 'block';
        carregarTudo();
    } else {
        document.getElementById('telaLogin').style.display = 'flex';
        document.getElementById('sistemaConteudo').style.display = 'none';
    }
});

function carregarTudo() {
    // Carregar Congregações
    onValue(congRef, (snap) => {
        const val = snap.val();
        dadosCongregacoes = val ? Object.keys(val).map(k => ({ id: k, ...val[k] })) : [];
        renderizarCongregacoes();
        atualizarSelectCongregacoes();
    });

    // Carregar Património
    onValue(patRef, (snap) => {
        const val = snap.val();
        dadosPatrimonio = val ? Object.keys(val).map(k => ({ id: k, ...val[k] })) : [];
        renderizarPatrimonio(dadosPatrimonio);
        gerarDashboard();
    });
}

// --- GESTÃO DE CONGREGAÇÕES ---
document.getElementById('formCongregacao').onsubmit = (e) => {
    e.preventDefault();
    const id = document.getElementById('congId').value;
    const dados = {
        nome: document.getElementById('congNome').value,
        responsavel: document.getElementById('congResponsavel').value,
        local: document.getElementById('congLocal').value
    };

    if (id) update(ref(db, `congregacoes/${id}`), dados);
    else push(congRef, dados);
    resetaCongregacao();
};

function renderizarCongregacoes() {
    const lista = document.getElementById('listaCongregacoes');
    lista.innerHTML = dadosCongregacoes.map(c => `
        <tr>
            <td><strong>${c.nome}</strong></td>
            <td>${c.responsavel || '-'}</td>
            <td>${c.local || '-'}</td>
            <td>
                <button class="btn btn-sm btn-link" onclick="editaCong('${c.id}')">✏️</button>
                <button class="btn btn-sm btn-link text-danger" onclick="apagaCong('${c.id}')">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function atualizarSelectCongregacoes() {
    const select = document.getElementById('patCongregacao');
    if (dadosCongregacoes.length === 0) {
        select.innerHTML = '<option value="">Registe uma congregação primeiro...</option>';
        return;
    }
    select.innerHTML = '<option value="">Selecione a Unidade...</option>' + 
        dadosCongregacoes.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');
}

window.editaCong = (id) => {
    const c = dadosCongregacoes.find(x => x.id === id);
    document.getElementById('congId').value = id;
    document.getElementById('congNome').value = c.nome;
    document.getElementById('congResponsavel').value = c.responsavel;
    document.getElementById('congLocal').value = c.local;
    document.getElementById('btnCancelaCong').classList.remove('d-none');
    document.getElementById('btnSalvarCong').innerText = "Atualizar Unidade";
};

window.resetaCongregacao = () => {
    document.getElementById('formCongregacao').reset();
    document.getElementById('congId').value = "";
    document.getElementById('btnCancelaCong').classList.add('d-none');
    document.getElementById('btnSalvarCong').innerText = "Registar Unidade";
};

window.apagaCong = (id) => confirm("Apagar unidade? Os itens desta unidade não serão apagados, mas ficarão sem referência.") && remove(ref(db, `congregacoes/${id}`));

// --- GESTÃO DE PATRIMÓNIO ---
document.getElementById('formPatrimonio').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('patId').value;
    const dataHoje = new Date().toLocaleDateString('pt-pt');
    
    const item = {
        congregacao: document.getElementById('patCongregacao').value,
        nome: document.getElementById('patNome').value,
        valor: parseFloat(document.getElementById('patValor').value),
        obs: document.getElementById('patObs').value,
        data: id ? (dadosPatrimonio.find(x => x.id === id).data) : dataHoje,
        foto: id ? (dadosPatrimonio.find(x => x.id === id).foto || "") : ""
    };

    const file = document.getElementById('patFoto').files[0];
    if (file) item.foto = await reduzirImagem(file);

    if (id) update(ref(db, `patrimonio/${id}`), item);
    else push(patRef, item);
    resetaPatrimonio();
};

function renderizarPatrimonio(dados) {
    const lista = document.getElementById('listaPatrimonio');
    lista.innerHTML = dados.map(i => `
        <tr>
            <td><img src="${i.foto || ''}" class="img-preview"></td>
            <td><strong>${i.nome}</strong><br><small class="text-muted">Cadastrado: ${i.data}</small></td>
            <td>${i.congregacao}</td>
            <td>R$ ${i.valor.toFixed(2)}</td>
            <td>
                <button class="btn btn-sm btn-link" onclick="editaPat('${i.id}')">✏️</button>
                <button class="btn btn-sm btn-link text-danger" onclick="apagaPat('${i.id}')">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function gerarDashboard() {
    let total = 0;
    let igrejasValores = {};
    dadosPatrimonio.forEach(i => {
        total += i.valor;
        igrejasValores[i.congregacao] = (igrejasValores[i.congregacao] || 0) + i.valor;
    });

    document.getElementById('dashItens').innerText = dadosPatrimonio.length;
    document.getElementById('dashValor').innerText = total.toLocaleString('pt-pt', { style: 'currency', currency: 'BRL' });

    let topIgreja = "--", maxVal = 0;
    for(let ig in igrejasValores) {
        if(igrejasValores[ig] > maxVal) { maxVal = igrejasValores[ig]; topIgreja = ig; }
    }
    document.getElementById('dashUnidade').innerText = topIgreja;
}

window.editaPat = (id) => {
    const i = dadosPatrimonio.find(x => x.id === id);
    document.getElementById('patId').value = id;
    document.getElementById('patNome').value = i.nome;
    document.getElementById('patValor').value = i.valor;
    document.getElementById('patCongregacao').value = i.congregacao;
    document.getElementById('patObs').value = i.obs || "";
    document.getElementById('btnCancelaPat').classList.remove('d-none');
    document.getElementById('btnSalvarPat').innerText = "Atualizar Item";
};

window.resetaPatrimonio = () => {
    document.getElementById('formPatrimonio').reset();
    document.getElementById('patId').value = "";
    document.getElementById('btnCancelaPat').classList.add('d-none');
    document.getElementById('btnSalvarPat').innerText = "Guardar Item";
};

window.apagaPat = (id) => confirm("Apagar este bem?") && remove(ref(db, `patrimonio/${id}`));

// Auxiliares
function reduzirImagem(file) {
    return new Promise(res => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 300; canvas.height = (img.height * 300) / img.width;
                canvas.getContext('2d').drawImage(img, 0, 0, 300, canvas.height);
                res(canvas.toDataURL('image/jpeg', 0.6));
            };
        };
    });
}

window.filtrarPatrimonio = () => {
    const t = document.getElementById('buscaPat').value.toLowerCase();
    renderizarPatrimonio(dadosPatrimonio.filter(i => i.nome.toLowerCase().includes(t) || i.congregacao.toLowerCase().includes(t)));
};

// Login
document.getElementById('formLogin').onsubmit = (e) => {
    e.preventDefault();
    signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginSenha').value)
    .catch(() => document.getElementById('loginErro').innerText = "Utilizador ou senha incorretos.");
};

window.fazerLogout = () => signOut(auth);

window.exportarExcel = () => {
    let csv = "\ufeffData;Nome;Congregacao;Valor;Obs\n";
    dadosPatrimonio.forEach(i => csv += `${i.data};${i.nome};${i.congregacao};${i.valor};${i.obs || ''}\n`);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
    a.download = "Relatorio_SGP.csv"; a.click();
};
