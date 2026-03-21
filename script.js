import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-auth.js";
import { getDatabase, ref, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-database.js";

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
const patRef = ref(db, 'patrimonio');
const congRef = ref(db, 'congregacoes');
const histRef = ref(db, 'historico');

let dadosPatrimonio = [], dadosCongregacoes = [], dadosHistorico = [];
let html5QrCode, itemSelecionadoId = null;

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
    onValue(congRef, snap => {
        const val = snap.val();
        dadosCongregacoes = val ? Object.keys(val).map(k => ({ id: k, ...val[k] })) : [];
        renderizarCongregacoes();
        atualizarSelects();
    });
    onValue(patRef, snap => {
        const val = snap.val();
        dadosPatrimonio = val ? Object.keys(val).map(k => ({ id: k, ...val[k] })) : [];
        renderizarPatrimonio(dadosPatrimonio);
    });
    onValue(histRef, snap => {
        const val = snap.val();
        dadosHistorico = val ? Object.keys(val).map(k => ({ id: k, ...val[k] })) : [];
        renderizarHistoricoGlobal();
    });
}

function renderizarPatrimonio(dados) {
    document.getElementById('listaPatrimonio').innerHTML = dados.map(i => `
        <tr>
            <td><img src="${i.foto || ''}" class="img-preview" onclick="exibirPopupItem('${i.id}')"></td>
            <td><strong>${i.nome}</strong><br><small class="text-muted">SN: ${i.serie || '---'}</small></td>
            <td><span class="badge bg-light text-dark border">${i.congregacao}</span></td>
            <td>
                <div class="btn-group shadow-sm">
                    <button class="btn btn-sm btn-light" onclick="gerarEtiqueta('${i.id}')" title="Etiqueta"><i class="fas fa-print"></i></button>
                    <button class="btn btn-sm btn-light text-primary" onclick="editaPat('${i.id}')" title="Editar"><i class="fas fa-pen"></i></button>
                    <button class="btn btn-sm btn-light text-danger" onclick="confirmarExclusao('${i.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`).join('');
}

// EDIÇÃO EM MODAL
window.editaPat = (id) => {
    const i = dadosPatrimonio.find(x => x.id === id);
    document.getElementById('editId').value = id;
    document.getElementById('editNome').value = i.nome;
    document.getElementById('editSerie').value = i.serie || "";
    document.getElementById('editValor').value = i.valor;
    document.getElementById('editCongregacao').value = i.congregacao;
    new bootstrap.Modal(document.getElementById('modalEdicao')).show();
};

document.getElementById('formEdicaoDinamica').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('editId').value;
    const original = dadosPatrimonio.find(x => x.id === id);
    const dados = {
        nome: document.getElementById('editNome').value,
        serie: document.getElementById('editSerie').value,
        valor: parseFloat(document.getElementById('editValor').value),
        congregacao: document.getElementById('editCongregacao').value,
        foto: original.foto,
        data: original.data
    };
    const file = document.getElementById('editFoto').files[0];
    if (file) dados.foto = await reduzirImagem(file);
    update(ref(db, `patrimonio/${id}`), dados);
    bootstrap.Modal.getInstance(document.getElementById('modalEdicao')).hide();
};

// EXCLUSÃO
window.confirmarExclusao = (id) => {
    if (confirm("Deseja realmente excluir este item?")) {
        remove(ref(db, `patrimonio/${id}`));
    }
};

// IMPRESSÃO ETIQUETA
window.gerarEtiqueta = (id) => {
    const item = dadosPatrimonio.find(x => x.id === id);
    const container = document.getElementById("qrcode");
    container.innerHTML = "";
    document.getElementById("printIgreja").innerText = item.congregacao;
    document.getElementById("printItem").innerText = item.nome;
    document.getElementById("printSerial").innerText = item.serie ? "SN: "+item.serie : "ID: "+item.id.substring(0,8);
    new QRCode(container, { text: `ID:${item.id}`, width: 140, height: 140 });
    setTimeout(() => window.print(), 500);
};

// PWA: INSTALAÇÃO
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('btnInstalar').classList.remove('d-none');
});

document.getElementById('btnInstalar').addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') document.getElementById('btnInstalar').classList.add('d-none');
        deferredPrompt = null;
    }
});

// RESTANTE DAS FUNÇÕES (CADASTRO, IMAGEM, LOGIN)
document.getElementById('formPatrimonio').onsubmit = async (e) => {
    e.preventDefault();
    const item = {
        congregacao: document.getElementById('patCongregacao').value,
        nome: document.getElementById('patNome').value,
        serie: document.getElementById('patSerie').value,
        valor: parseFloat(document.getElementById('patValor').value),
        data: new Date().toLocaleDateString('pt-br'),
        foto: ""
    };
    const file = document.getElementById('patFoto').files[0];
    if (file) item.foto = await reduzirImagem(file);
    push(patRef, item);
    e.target.reset();
};

function atualizarSelects() {
    const opt = '<option value="">Selecione...</option>' + dadosCongregacoes.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');
    document.getElementById('patCongregacao').innerHTML = opt;
    document.getElementById('editCongregacao').innerHTML = opt;
}

function reduzirImagem(file) {
    return new Promise(res => {
        const reader = new FileReader(); reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image(); img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 300; canvas.height = (img.height * 300) / img.width;
                canvas.getContext('2d').drawImage(img, 0, 0, 300, canvas.height);
                res(canvas.toDataURL('image/jpeg', 0.6));
            };
        };
    });
}

document.getElementById('formLogin').onsubmit = (e) => {
    e.preventDefault();
    signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginSenha').value);
};

window.fazerLogout = () => signOut(auth);
