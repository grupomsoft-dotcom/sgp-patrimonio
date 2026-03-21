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
    appId: "1:208251232334:web:0c857d289b755921be231f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const patRef = ref(db, 'patrimonio');
const congRef = ref(db, 'congregacoes');
const histRef = ref(db, 'historico');

let dadosPatrimonio = [], dadosCongregacoes = [], dadosHistorico = [];
let html5QrCode, itemParaMoverID = null;

// AUTH
onAuthStateChanged(auth, user => {
    document.getElementById('telaLogin').style.display = user ? 'none' : 'flex';
    document.getElementById('sistemaConteudo').style.display = user ? 'block' : 'none';
    if(user) carregarDados();
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

// RENDER
function renderizarPatrimonio(dados) {
    document.getElementById('listaPatrimonio').innerHTML = dados.map(i => `
        <tr>
            <td><img src="${i.foto || ''}" class="img-preview me-2"><strong>${i.nome}</strong></td>
            <td><span class="badge bg-light text-dark">${i.congregacao}</span></td>
            <td>
                <button class="btn btn-sm btn-light" onclick="gerarEtiqueta('${i.id}')"><i class="fas fa-print"></i></button>
                <button class="btn btn-sm btn-light text-primary" onclick="editaPat('${i.id}')"><i class="fas fa-pen"></i></button>
                <button class="btn btn-sm btn-light text-danger" onclick="confirmarExclusao('${i.id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`).join('');
}

function renderizarCongregacoes() {
    document.getElementById('listaCongregacoes').innerHTML = dadosCongregacoes.map(c => `<tr><td>${c.nome}</td><td class="text-end"><button class="btn btn-sm text-danger" onclick="excluirCong('${c.id}')"><i class="fas fa-times"></i></button></td></tr>`).join('');
}

function renderizarHistoricoGlobal() {
    document.getElementById('listaHistoricoGlobal').innerHTML = dadosHistorico.slice().reverse().map(h => `
        <div class="small p-2 mb-1 bg-light rounded shadow-sm border-start border-primary border-4">${h.data}: <b>${h.itemName}</b> (${h.origem} ➔ ${h.destino})</div>
    `).join('');
}

// SCANNER & MOVER
window.abrirScannerParaMover = () => {
    new bootstrap.Modal(document.getElementById('modalScanner')).show();
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, text => {
        if (text.startsWith("ID:")) {
            const id = text.replace("ID:", "").trim();
            html5QrCode.stop().then(() => {
                bootstrap.Modal.getInstance(document.getElementById('modalScanner')).hide();
                prepararTransferencia(id);
            });
        }
    });
};

function prepararTransferencia(id) {
    const item = dadosPatrimonio.find(x => x.id === id);
    if(!item) return alert("Item não encontrado!");
    itemParaMoverID = id;
    document.getElementById('formMoverArea').classList.remove('d-none');
    document.getElementById('moverNomeItem').innerText = item.nome;
    document.getElementById('moverLocalAtual').innerText = item.congregacao;
}

window.executarTransferenciaPagina = () => {
    const dest = document.getElementById('transfDestinoFinal').value;
    const item = dadosPatrimonio.find(x => x.id === itemParaMoverID);
    if(!dest || dest === item.congregacao) return alert("Selecione um destino válido!");
    push(histRef, { itemId: itemParaMoverID, itemName: item.nome, origem: item.congregacao, destino: dest, data: new Date().toLocaleString('pt-br') });
    update(ref(db, `patrimonio/${itemParaMoverID}`), { congregacao: dest }).then(() => {
        alert("Sucesso!");
        document.getElementById('formMoverArea').classList.add('d-none');
    });
};

// ACTIONS
window.fazerLogout = () => signOut(auth);
window.gerarEtiqueta = (id) => {
    const item = dadosPatrimonio.find(x => x.id === id);
    const container = document.getElementById("qrcode");
    container.innerHTML = "";
    document.getElementById("printIgreja").innerText = item.congregacao;
    document.getElementById("printItem").innerText = item.nome;
    document.getElementById("printSerial").innerText = "SN: " + (item.serie || "---");
    new QRCode(container, { text: `ID:${item.id}`, width: 140, height: 140 });
    setTimeout(() => window.print(), 500);
};

window.editaPat = (id) => {
    const i = dadosPatrimonio.find(x => x.id === id);
    document.getElementById('editId').value = id;
    document.getElementById('editNome').value = i.nome;
    document.getElementById('editSerie').value = i.serie || "";
    document.getElementById('editCongregacao').value = i.congregacao;
    new bootstrap.Modal(document.getElementById('modalEdicao')).show();
};

document.getElementById('formPatrimonio').onsubmit = async e => {
    e.preventDefault();
    const item = { congregacao: document.getElementById('patCongregacao').value, nome: document.getElementById('patNome').value, serie: document.getElementById('patSerie').value || "", valor: parseFloat(document.getElementById('patValor').value), data: new Date().toLocaleDateString('pt-br'), foto: "" };
    const file = document.getElementById('patFoto').files[0];
    if (file) item.foto = await reduzirImagem(file);
    push(patRef, item); e.target.reset();
};

document.getElementById('formLogin').onsubmit = e => {
    e.preventDefault();
    signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginSenha').value);
};

// HELPERS
function atualizarSelects() {
    const opt = '<option value="">Selecione...</option>' + dadosCongregacoes.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');
    document.getElementById('patCongregacao').innerHTML = opt;
    document.getElementById('editCongregacao').innerHTML = opt;
    document.getElementById('transfDestinoFinal').innerHTML = opt;
}

function reduzirImagem(file) {
    return new Promise(res => {
        const reader = new FileReader(); reader.readAsDataURL(file);
        reader.onload = e => {
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
// --- LÓGICA DE INSTALAÇÃO PWA ---
let deferredPrompt;

// 1. Escuta o pedido de instalação do navegador
window.addEventListener('beforeinstallprompt', (e) => {
    // Previne que o Chrome mostre o banner automático feio
    e.preventDefault();
    // Guarda o evento para disparar quando o usuário clicar no seu botão
    deferredPrompt = e;
    
    // Faz o seu botão "INSTALAR APP" aparecer
    const btnInstalar = document.getElementById('btnInstalar');
    if (btnInstalar) {
        btnInstalar.classList.remove('d-none');
    }
});

// 2. Ação ao clicar no botão de instalar
const btnInstalar = document.getElementById('btnInstalar');
if (btnInstalar) {
    btnInstalar.addEventListener('click', async () => {
        if (deferredPrompt) {
            // Mostra a caixinha de instalação do Chrome
            deferredPrompt.prompt();
            
            // Verifica se o usuário aceitou ou cancelou
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                console.log('Usuário aceitou a instalação');
                btnInstalar.classList.add('d-none');
            }
            deferredPrompt = null;
        }
    });
}

// 3. Registro do Service Worker (Obrigatório para PWA)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker registrado!', reg))
            .catch(err => console.err('Falha ao registrar Service Worker', err));
    });
}
