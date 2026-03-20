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

// Seletores
const telaLogin = document.getElementById('telaLogin');
const sistemaConteudo = document.getElementById('sistemaConteudo');
const formLogin = document.getElementById('formLogin');
const listaTabela = document.getElementById('listaPatrimonio');

let dadosGlobais = [];

// ==========================================
// 1. GERENCIAMENTO DE ACESSO (LOGIN/LOGOUT)
// ==========================================

// Observador: Verifica se o usuário está logado
onAuthStateChanged(auth, (user) => {
    if (user) {
        telaLogin.style.display = 'none';
        sistemaConteudo.style.display = 'block';
        carregarDadosBanco();
    } else {
        telaLogin.style.display = 'flex';
        sistemaConteudo.style.display = 'none';
    }
});

// Ação de Logar
formLogin.onsubmit = (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const senha = document.getElementById('loginSenha').value;
    const erroDiv = document.getElementById('loginErro');

    signInWithEmailAndPassword(auth, email, senha)
        .catch(error => {
            erroDiv.innerText = "Acesso negado: E-mail ou senha inválidos.";
            console.error(error);
        });
};

// Ação de Sair
window.fazerLogout = () => {
    if(confirm("Deseja encerrar a sessão?")) signOut(auth);
};

// ==========================================
// 2. LÓGICA DO PATRIMÔNIO (CRUD)
// ==========================================

function carregarDadosBanco() {
    onValue(patrimonioRef, (snapshot) => {
        const data = snapshot.val();
        dadosGlobais = [];
        if (data) {
            Object.keys(data).forEach(key => {
                dadosGlobais.push({ id: key, ...data[key] });
            });
        }
        renderizarTabela(dadosGlobais);
    });
}

document.getElementById('formPatrimonio').onsubmit = async (e) => {
    e.preventDefault();
    const idEdicao = document.getElementById('editId').value;
    const inputFoto = document.getElementById('fotoItem');
    const btnSalvar = document.getElementById('btnSalvar');
    
    btnSalvar.disabled = true;
    let fotoBase64 = idEdicao ? (dadosGlobais.find(i => i.id == idEdicao).foto || "") : "";

    if (inputFoto.files[0]) {
        btnSalvar.innerText = "Processando foto...";
        fotoBase64 = await reduzirImagem(inputFoto.files[0]);
    }

    const item = {
        congregacao: document.getElementById('congregacao').value,
        nome: document.getElementById('nomeItem').value,
        valor: parseFloat(document.getElementById('valorItem').value),
        obs: document.getElementById('obsItem').value,
        foto: fotoBase64
    };

    if (idEdicao) {
        update(ref(db, `patrimonio/${idEdicao}`), item);
        cancelarEdicao();
    } else {
        push(patrimonioRef, item);
    }
    
    e.target.reset();
    btnSalvar.disabled = false;
    btnSalvar.innerText = "Salvar na Nuvem";
};

window.removerItem = (id) => {
    if (confirm("Apagar permanentemente da nuvem?")) remove(ref(db, `patrimonio/${id}`));
};

window.prepararEdicao = (id) => {
    const item = dadosGlobais.find(i => i.id == id);
    document.getElementById('editId').value = id;
    document.getElementById('nomeItem').value = item.nome;
    document.getElementById('valorItem').value = item.valor;
    document.getElementById('congregacao').value = item.congregacao;
    document.getElementById('obsItem').value = item.obs || "";
    document.getElementById('tituloForm').innerText = "Editando Registro";
    document.getElementById('btnSalvar').innerText = "Atualizar Online";
    document.getElementById('btnCancelar').classList.remove('d-none');
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.cancelarEdicao = () => {
    document.getElementById('editId').value = "";
    document.getElementById('tituloForm').innerText = "Novo Registro";
    document.getElementById('btnSalvar').innerText = "Salvar na Nuvem";
    document.getElementById('btnCancelar').classList.add('d-none');
    document.getElementById('formPatrimonio').reset();
};

function renderizarTabela(dados) {
    listaTabela.innerHTML = '';
    dados.forEach(item => {
        const tr = document.createElement('tr');
        const fotoHTML = item.foto ? `<img src="${item.foto}" class="img-patrimonio">` : `🖼️`;
        tr.innerHTML = `
            <td>${fotoHTML}</td>
            <td><strong>${item.nome}</strong><br><small class="text-muted">${item.obs || ''}</small></td>
            <td><span class="badge bg-secondary">${item.congregacao}</span></td>
            <td>R$ ${item.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary mb-1" onclick="prepararEdicao('${item.id}')">Editar</button>
                <button class="btn btn-sm btn-outline-danger" onclick="removerItem('${item.id}')">Excluir</button>
            </td>
        `;
        listaTabela.appendChild(tr);
    });
}

// Funções Auxiliares (Filtro e Imagem)
window.filtrarItens = () => {
    const busca = document.getElementById('buscaNome').value.toLowerCase();
    const igreja = document.getElementById('filtroCongregacao').value;
    const filtrados = dadosGlobais.filter(i => 
        (i.nome.toLowerCase().includes(busca) || (i.obs && i.obs.toLowerCase().includes(busca))) &&
        (igreja === "" || i.congregacao === igreja)
    );
    renderizarTabela(filtrados);
};

function reduzirImagem(arquivo) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(arquivo);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 300; canvas.height = (img.height * 300) / img.width;
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.6));
            };
        };
    });
}

window.exportarExcel = () => {
    let csv = "\ufeffNome;Obs;Congregacao;Valor\n";
    dadosGlobais.forEach(i => csv += `${i.nome};${i.obs || ''};${i.congregacao};${i.valor.toFixed(2)}\n`);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = "Patrimonio_Igreja.csv";
    a.click();
};
