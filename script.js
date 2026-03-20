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

// CONTROLE DE ACESSO
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

// SCANNER QR
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

// VISUALIZAÇÃO E EDIÇÃO DINÂMICA
window.exibirPopupItem = (id) => {
    const item = dadosPatrimonio.find(x => x.id === id);
    if (!item) return;
    itemSelecionadoId = id;
    document.getElementById('viewFoto').src = item.foto || 'https://via.placeholder.com/300?text=Sem+Foto';
    document.getElementById('viewNome').innerText = item.nome;
    document.getElementById('viewSerie').innerText = item.serie || 'N/A';
    document.getElementById('viewCongregacao').innerText = item.congregacao;
    document.getElementById('viewValor').innerText = item.valor.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });
    
    const h = dadosHistorico.filter(x => x.itemId === id).reverse();
    document.getElementById('viewTimeline').innerHTML = h.map(x => `<div class="hist-item">${x.data.split(' ')[0]}: ${x.origem} ➔ ${x.destino}</div>`).join('') || '<small class="text-muted">Sem movimentações.</small>';
    new bootstrap.Modal(document.getElementById('modalView')).show();
};

window.editaPat = (id) => {
    const i = dadosPatrimonio.find(x => x.id === id);
    itemSelecionadoId = id;
    document.getElementById('editId').value = id;
    document.getElementById('editNome').value = i.nome;
    document.getElementById('editSerie').value = i.serie || "";
    document.getElementById('editValor').value = i.valor;
    document.getElementById('editCongregacao').value = i.congregacao;
    new bootstrap.Modal(document.getElementById('modalEdicao')).show();
};

window.irParaEditar = () => {
    bootstrap.Modal.getInstance(document.getElementById('modalView')).hide();
    editaPat(itemSelecionadoId);
};

// EXCLUSÃO
window.confirmarExclusao = (id) => {
    const item = dadosPatrimonio.find(x => x.id === id);
    if (confirm(`Excluir definitivamente "${item.nome}"?`)) {
        remove(ref(db, `patrimonio/${id}`));
    }
};

// IMPRESSÃO (ETIQUETA ÚNICA)
window.gerarEtiqueta = (id) => {
    const item = dadosPatrimonio.find(x => x.id === id);
    const container = document.getElementById("qrcode");
    container.innerHTML = "";
    document.getElementById("printIgreja").innerText = item.congregacao;
    document.getElementById("printItem").innerText = item.nome;
    document.getElementById("printSerial").innerText = item.serie ? "Série: "+item.serie : "ID: "+item.id.substring(0,8);

    new QRCode(container, { text: `ID:${item.id}`, width: 140, height: 140, correctLevel: QRCode.CorrectLevel.H });
    setTimeout(() => { window.print(); }, 500);
};

// FORMULÁRIOS
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

// INTERFACE
function renderizarPatrimonio(dados) {
    document.getElementById('listaPatrimonio').innerHTML = dados.map(i => `
        <tr>
            <td><img src="${i.foto || ''}" class="img-preview" onclick="exibirPopupItem('${i.id}')"></td>
            <td><strong>${i.nome}</strong><br><small class="text-muted">${i.serie || 's/ série'}</small></td>
            <td><span class="badge bg-light text-dark border">${i.congregacao}</span></td>
            <td>
                <div class="btn-group">
                    <button class="btn btn-sm btn-light" onclick="gerarEtiqueta('${i.id}')"><i class="fas fa-print"></i></button>
                    <button class="btn btn-sm btn-light text-primary" onclick="editaPat('${i.id}')"><i class="fas fa-pen"></i></button>
                    <button class="btn btn-sm btn-light text-danger" onclick="confirmarExclusao('${i.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`).join('');
}

// ... Restante das funções auxiliares (Mesma lógica ChMS Pro) ...
window.confirmarTransferencia = () => {
    const dest = document.getElementById('transfDestino').value;
    const item = dadosPatrimonio.find(x => x.id === itemSelecionadoId);
    if (!dest || dest === item.congregacao) return;
    push(histRef, { itemId: itemSelecionadoId, itemName: item.nome, origem: item.congregacao, destino: dest, data: new Date().toLocaleString('pt-br') });
    update(ref(db, `patrimonio/${itemSelecionadoId}`), { congregacao: dest });
    bootstrap.Modal.getInstance(document.getElementById('modalTransferir')).hide();
    bootstrap.Modal.getInstance(document.getElementById('modalView')).hide();
};

function atualizarDashboard() {
    let tot = 0, u = {};
    dadosPatrimonio.forEach(i => { tot += i.valor; u[i.congregacao] = (u[i.congregacao] || 0) + 1; });
    document.getElementById('dashItens').innerText = dadosPatrimonio.length;
    document.getElementById('dashValor').innerText = tot.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });
    let top = "--", max = 0;
    for(let k in u) if(u[k] > max) { max = u[k]; top = k; }
    document.getElementById('dashUnidade').innerText = top;
}

function atualizarSelects() {
    const opt = '<option value="">Selecione...</option>' + dadosCongregacoes.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');
    document.getElementById('patCongregacao').innerHTML = opt;
    document.getElementById('editCongregacao').innerHTML = opt;
    document.getElementById('transfDestino').innerHTML = opt;
}

document.getElementById('formLogin').onsubmit = (e) => {
    e.preventDefault();
    signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginSenha').value);
};

document.getElementById('formCongregacao').onsubmit = (e) => {
    e.preventDefault();
    push(congRef, { nome: document.getElementById('congNome').value });
    e.target.reset();
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

window.fazerLogout = () => signOut(auth);
