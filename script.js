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
const patrimonioRef = ref(db, 'patrimonio');

let dadosGlobais = [];

// Monitor de Login
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('telaLogin').style.display = 'none';
        document.getElementById('sistemaConteudo').style.display = 'block';
        carregarDados();
    } else {
        document.getElementById('telaLogin').style.display = 'flex';
        document.getElementById('sistemaConteudo').style.display = 'none';
    }
});

function carregarDados() {
    onValue(patrimonioRef, (snapshot) => {
        const data = snapshot.val();
        dadosGlobais = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
        renderizarTabela(dadosGlobais);
        atualizarDashboard();
    });
}

// NOVA FUNÇÃO: CALCULA OS NÚMEROS DO TOPO
function atualizarDashboard() {
    let totalValor = 0;
    let contagemPorIgreja = {};

    dadosGlobais.forEach(item => {
        totalValor += item.valor;
        // Contagem para descobrir qual igreja tem mais valor
        contagemPorIgreja[item.congregacao] = (contagemPorIgreja[item.congregacao] || 0) + item.valor;
    });

    // Atualiza os cards
    document.getElementById('dashTotalItens').innerText = dadosGlobais.length;
    document.getElementById('dashValorTotal').innerText = totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // Descobre a igreja com maior patrimônio
    let maiorIgreja = "--";
    let maiorSoma = 0;
    for (let igreja in contagemPorIgreja) {
        if (contagemPorIgreja[igreja] > maiorSoma) {
            maiorSoma = contagemPorIgreja[igreja];
            maiorIgreja = igreja;
        }
    }
    document.getElementById('dashMaiorIgreja').innerText = maiorIgreja;
}

// Funções de Login e CRUD (Mesmas anteriores simplificadas)
document.getElementById('formLogin').onsubmit = (e) => {
    e.preventDefault();
    signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginSenha').value)
    .catch(() => document.getElementById('loginErro').innerText = "Erro no acesso.");
};

window.fazerLogout = () => signOut(auth);

document.getElementById('formPatrimonio').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('editId').value;
    const btn = document.getElementById('btnSalvar');
    btn.disabled = true;

    const item = {
        congregacao: document.getElementById('congregacao').value,
        nome: document.getElementById('nomeItem').value,
        valor: parseFloat(document.getElementById('valorItem').value),
        obs: document.getElementById('obsItem').value,
        foto: id ? (dadosGlobais.find(i => i.id == id).foto || "") : ""
    };

    const file = document.getElementById('fotoItem').files[0];
    if (file) item.foto = await reduzirImagem(file);

    if (id) update(ref(db, `patrimonio/${id}`), item);
    else push(patrimonioRef, item);

    cancelarEdicao();
    btn.disabled = false;
};

window.removerItem = (id) => confirm("Apagar?") && remove(ref(db, `patrimonio/${id}`));

window.prepararEdicao = (id) => {
    const i = dadosGlobais.find(item => item.id == id);
    document.getElementById('editId').value = id;
    document.getElementById('nomeItem').value = i.nome;
    document.getElementById('valorItem').value = i.valor;
    document.getElementById('congregacao').value = i.congregacao;
    document.getElementById('obsItem').value = i.obs || "";
    document.getElementById('btnCancelar').classList.remove('d-none');
    document.getElementById('btnSalvar').innerText = "Atualizar";
};

window.cancelarEdicao = () => {
    document.getElementById('editId').value = "";
    document.getElementById('formPatrimonio').reset();
    document.getElementById('btnCancelar').classList.add('d-none');
    document.getElementById('btnSalvar').innerText = "Salvar na Nuvem";
};

function renderizarTabela(dados) {
    const tbody = document.getElementById('listaPatrimonio');
    tbody.innerHTML = '';
    dados.forEach(i => {
        tbody.innerHTML += `
            <tr>
                <td><img src="${i.foto || ''}" class="img-patrimonio"></td>
                <td><strong>${i.nome}</strong><br><small class="text-muted">${i.congregacao}</small></td>
                <td>R$ ${i.valor.toFixed(2)}</td>
                <td>
                    <button class="btn btn-sm btn-link" onclick="prepararEdicao('${i.id}')">✏️</button>
                    <button class="btn btn-sm btn-link text-danger" onclick="removerItem('${i.id}')">🗑️</button>
                </td>
            </tr>`;
    });
}

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

window.filtrarItens = () => {
    const b = document.getElementById('buscaNome').value.toLowerCase();
    renderizarTabela(dadosGlobais.filter(i => i.nome.toLowerCase().includes(b)));
};

window.exportarExcel = () => {
    let csv = "\ufeffNome;Igreja;Valor\n";
    dadosGlobais.forEach(i => csv += `${i.nome};${i.congregacao};${i.valor}\n`);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
    a.download = "Patrimonio.csv"; a.click();
};
