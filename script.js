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

// AUTENTICAÇÃO
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
    onValue(congRef, (snap) => {
        const val = snap.val();
        dadosCongregacoes = val ? Object.keys(val).map(k => ({ id: k, ...val[k] })) : [];
        renderizarCongregacoes();
        atualizarSelects();
    });
    onValue(patRef, (snap) => {
        const val = snap.val();
        dadosPatrimonio = val ? Object.keys(val).map(k => ({ id: k, ...val[k] })) : [];
        renderizarPatrimonio(dadosPatrimonio);
        atualizarDashboard();
    });
    onValue(histRef, (snap) => {
        const val = snap.val();
        dadosHistorico = val ? Object.keys(val).map(k => ({ id: k, ...val[k] })) : [];
        renderizarHistoricoGlobal();
    });
}

// SCANNER
window.abrirScanner = () => {
    const modalScanner = new bootstrap.Modal(document.getElementById('modalScanner'));
    modalScanner.show();
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 200 }, (text) => {
        if (text.startsWith("ID:")) {
            pararScanner(); modalScanner.hide();
            exibirPopupItem(text.split("ID:")[1].split("\n")[0]);
        }
    });
};

window.pararScanner = () => html5QrCode && html5QrCode.stop().then(() => html5QrCode.clear());

// POPUP VIEW
window.exibirPopupItem = (id) => {
    const item = dadosPatrimonio.find(x => x.id === id);
    if (!item) return;
    itemSelecionadoId = id;
    document.getElementById('viewFoto').src = item.foto || 'https://via.placeholder.com/300?text=Sem+Foto';
    document.getElementById('viewNome').innerText = item.nome;
    document.getElementById('viewCongregacao').innerText = item.congregacao;
    document.getElementById('viewValor').innerText = item.valor.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });
    
    const hItem = dadosHistorico.filter(h => h.itemId === id).reverse();
    document.getElementById('viewTimeline').innerHTML = hItem.map(h => `
        <div class="hist-item">${h.data.split(' ')[0]}: ${h.origem} ➔ ${h.destino}</div>
    `).join('') || '<small class="text-muted">Sem movimentações.</small>';
    
    new bootstrap.Modal(document.getElementById('modalView')).show();
};

// IMPRESSÃO DA ETIQUETA (CORRIGIDO)
window.gerarEtiqueta = (id) => {
    const item = dadosPatrimonio.find(x => x.id === id);
    const container = document.getElementById("qrcode");
    container.innerHTML = ""; // Limpa anterior
    
    document.getElementById("printIgreja").innerText = item.congregacao.toUpperCase();
    document.getElementById("printItem").innerText = item.nome;
    document.getElementById("printID").innerText = "ID: " + item.id.substring(0, 8);

    new QRCode(container, { text: `ID:${item.id}`, width: 130, height: 130, correctLevel: QRCode.CorrectLevel.H });

    setTimeout(() => { window.print(); }, 500); // Aguarda desenho do QR
};

// TRANSFERÊNCIA
window.abrirModalTransferir = () => new bootstrap.Modal(document.getElementById('modalTransferir')).show();
window.confirmarTransferencia = () => {
    const destino = document.getElementById('transfDestino').value;
    const item = dadosPatrimonio.find(x => x.id === itemSelecionadoId);
    if (!destino || destino === item.congregacao) return alert("Escolha um destino válido.");
    
    push(histRef, { itemId: itemSelecionadoId, itemName: item.nome, origem: item.congregacao, destino: destino, data: new Date().toLocaleString('pt-br') });
    update(ref(db, `patrimonio/${itemSelecionadoId}`), { congregacao: destino });
    bootstrap.Modal.getInstance(document.getElementById('modalTransferir')).hide();
    bootstrap.Modal.getInstance(document.getElementById('modalView')).hide();
};

// FUNÇÕES AUXILIARES
document.getElementById('formPatrimonio').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('patId').value;
    const item = {
        congregacao: document.getElementById('patCongregacao').value,
        nome: document.getElementById('patNome').value,
        valor: parseFloat(document.getElementById('patValor').value),
        data: id ? (dadosPatrimonio.find(x => x.id === id).data) : new Date().toLocaleDateString('pt-br'),
        foto: id ? (dadosPatrimonio.find(x => x.id === id).foto || "") : ""
    };
    const file = document.getElementById('patFoto').files[0];
    if (file) item.foto = await reduzirImagem(file);
    if (id) update(ref(db, `patrimonio/${id}`), item); else push(patRef, item);
    resetaPatrimonio();
};

function renderizarPatrimonio(dados) {
    document.getElementById('listaPatrimonio').innerHTML = dados.map(i => `
        <tr>
            <td><img src="${i.foto || ''}" class="img-preview" onclick="exibirPopupItem('${i.id}')"></td>
            <td><strong>${i.nome}</strong><br><small>R$ ${i.valor.toFixed(2)}</small></td>
            <td><span class="badge bg-light text-dark">${i.congregacao}</span></td>
            <td>
                <button class="btn btn-sm btn-outline-dark" onclick="gerarEtiqueta('${i.id}')"><i class="fas fa-print"></i></button>
                <button class="btn btn-sm btn-link" onclick="editaPat('${i.id}')"><i class="fas fa-edit"></i></button>
            </td>
        </tr>`).join('');
}

window.editaPat = (id) => {
    const i = dadosPatrimonio.find(x => x.id === id);
    document.getElementById('patId').value = id;
    document.getElementById('patNome').value = i.nome;
    document.getElementById('patValor').value = i.valor;
    document.getElementById('patCongregacao').value = i.congregacao;
    document.getElementById('btnSalvarPat').innerText = "ATUALIZAR";
    document.getElementById('btnCancelaPat').classList.remove('d-none');
};

window.irParaEditar = () => { bootstrap.Modal.getInstance(document.getElementById('modalView')).hide(); editaPat(itemSelecionadoId); };
window.fazerLogout = () => signOut(auth);
window.resetaPatrimonio = () => { document.getElementById('formPatrimonio').reset(); document.getElementById('patId').value = ""; document.getElementById('btnSalvarPat').innerText = "SALVAR"; document.getElementById('btnCancelaPat').classList.add('d-none'); };

function atualizarDashboard() {
    let total = 0, u = {};
    dadosPatrimonio.forEach(i => { total += i.valor; u[i.congregacao] = (u[i.congregacao] || 0) + 1; });
    document.getElementById('dashItens').innerText = dadosPatrimonio.length;
    document.getElementById('dashValor').innerText = total.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });
    let top = "--", m = 0;
    for(let k in u) if(u[k] > m) { m = u[k]; top = k; }
    document.getElementById('dashUnidade').innerText = top;
}

function atualizarSelects() {
    const opt = '<option value="">Selecione...</option>' + dadosCongregacoes.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');
    document.getElementById('patCongregacao').innerHTML = opt;
    document.getElementById('transfDestino').innerHTML = opt;
}

document.getElementById('formLogin').onsubmit = (e) => {
    e.preventDefault();
    signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginSenha').value);
};

document.getElementById('formCongregacao').onsubmit = (e) => {
    e.preventDefault();
    push(congRef, { nome: document.getElementById('congNome').value });
    document.getElementById('formCongregacao').reset();
};

function renderizarCongregacoes() {
    document.getElementById('listaCongregacoes').innerHTML = dadosCongregacoes.map(c => `<tr class="border-bottom"><td>${c.nome}</td></tr>`).join('');
}

function renderizarHistoricoGlobal() {
    document.getElementById('listaHistoricoGlobal').innerHTML = dadosHistorico.slice().reverse().map(h => `
        <div class="card p-2 mb-2 small bg-light">${h.data}: <b>${h.itemName}</b> (${h.origem} ➔ ${h.destino})</div>
    `).join('');
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
