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
    if (user) { document.getElementById('telaLogin').style.display = 'none'; document.getElementById('sistemaConteudo').style.display = 'block'; carregarDados(); }
    else { document.getElementById('telaLogin').style.display = 'flex'; document.getElementById('sistemaConteudo').style.display = 'none'; }
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

// LOGICA SCANNER
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

window.exibirPopupItem = (id) => {
    const item = dadosPatrimonio.find(x => x.id === id);
    itemSelecionadoId = id;
    document.getElementById('viewFoto').src = item.foto || 'https://via.placeholder.com/300?text=Sem+Foto';
    document.getElementById('viewNome').innerText = item.nome;
    document.getElementById('viewCongregacao').innerText = item.congregacao;
    document.getElementById('viewValor').innerText = item.valor.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });
    const histItem = dadosHistorico.filter(h => h.itemId === id).reverse();
    document.getElementById('viewTimeline').innerHTML = histItem.slice(0, 3).map(h => `
        <div class="hist-item">
            <strong>${h.destino}</strong> <small class="text-muted float-end">${h.data.split(' ')[0]}</small>
        </div>
    `).join('') || '<p class="text-muted small">Sem histórico anterior.</p>';
    new bootstrap.Modal(document.getElementById('modalView')).show();
};

window.confirmarTransferencia = () => {
    const novoDestino = document.getElementById('transfDestino').value;
    const item = dadosPatrimonio.find(x => x.id === itemSelecionadoId);
    if (!novoDestino || novoDestino === item.congregacao) return alert("Selecione um destino diferente.");
    
    push(histRef, { itemId: itemSelecionadoId, itemName: item.nome, origem: item.congregacao, destino: novoDestino, data: new Date().toLocaleString('pt-br') });
    update(ref(db, `patrimonio/${itemSelecionadoId}`), { congregacao: novoDestino });
    bootstrap.Modal.getInstance(document.getElementById('modalTransferir')).hide();
    bootstrap.Modal.getInstance(document.getElementById('modalView')).hide();
};

function renderizarPatrimonio(dados) {
    document.getElementById('listaPatrimonio').innerHTML = dados.map(i => `
        <tr>
            <td><img src="${i.foto || ''}" class="img-preview shadow-sm" onclick="exibirPopupItem('${i.id}')" style="cursor:pointer"></td>
            <td><span class="fw-bold">${i.nome}</span><br><small class="text-muted">R$ ${i.valor.toFixed(2)}</small></td>
            <td><span class="badge bg-light text-dark border">${i.congregacao}</span></td>
            <td class="fw-bold text-success">R$ ${i.valor.toFixed(2)}</td>
            <td>
                <button class="btn btn-sm btn-light" onclick="gerarEtiqueta('${i.id}')"><i class="fas fa-tag"></i></button>
                <button class="btn btn-sm btn-light" onclick="editaPat('${i.id}')"><i class="fas fa-pen text-primary"></i></button>
            </td>
        </tr>`).join('');
}

function renderizarHistoricoGlobal() {
    document.getElementById('listaHistoricoGlobal').innerHTML = dadosHistorico.slice().reverse().map(h => `
        <div class="card p-2 mb-2 border-0 bg-light">
            <small class="text-muted">${h.data}</small>
            <div class="small fw-bold">${h.itemName}</div>
            <div class="text-muted small">${h.origem} <i class="fas fa-arrow-right mx-1"></i> ${h.destino}</div>
        </div>
    `).join('');
}

// RESTO DAS FUNÇÕES (MESMA LOGICA DO 3.7)
document.getElementById('formPatrimonio').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('patId').value;
    const item = {
        congregacao: document.getElementById('patCongregacao').value,
        nome: document.getElementById('patNome').value,
        valor: parseFloat(document.getElementById('patValor').value),
        obs: document.getElementById('patObs').value,
        data: id ? (dadosPatrimonio.find(x => x.id === id).data) : new Date().toLocaleDateString('pt-br'),
        foto: id ? (dadosPatrimonio.find(x => x.id === id).foto || "") : ""
    };
    const file = document.getElementById('patFoto').files[0];
    if (file) item.foto = await reduzirImagem(file);
    if (id) update(ref(db, `patrimonio/${id}`), item); else push(patRef, item);
    resetaPatrimonio();
};

window.editaPat = (id) => {
    const i = dadosPatrimonio.find(x => x.id === id);
    document.getElementById('patId').value = id;
    document.getElementById('patNome').value = i.nome;
    document.getElementById('patValor').value = i.valor;
    document.getElementById('patCongregacao').value = i.congregacao;
    document.getElementById('patObs').value = i.obs || "";
    document.getElementById('btnSalvarPat').innerText = "ATUALIZAR";
    document.getElementById('btnCancelaPat').classList.remove('d-none');
};

window.irParaEditar = () => { bootstrap.Modal.getInstance(document.getElementById('modalView')).hide(); editaPat(itemSelecionadoId); };
window.fazerLogout = () => signOut(auth);
window.resetaPatrimonio = () => { document.getElementById('formPatrimonio').reset(); document.getElementById('patId').value = ""; document.getElementById('btnSalvarPat').innerText = "SALVAR ATIVO"; document.getElementById('btnCancelaPat').classList.add('d-none'); };
window.pararScanner = () => html5QrCode && html5QrCode.stop().then(() => html5QrCode.clear());

function atualizarDashboard() {
    let total = 0, unidades = {};
    dadosPatrimonio.forEach(i => { total += i.valor; unidades[i.congregacao] = (unidades[i.congregacao] || 0) + i.valor; });
    document.getElementById('dashItens').innerText = dadosPatrimonio.length;
    document.getElementById('dashValor').innerText = total.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });
    let topU = "--", max = 0;
    for(let u in unidades) { if(unidades[u] > max) { max = unidades[u]; topU = u; } }
    document.getElementById('dashUnidade').innerText = topU;
}

function atualizarSelects() {
    const opt = '<option value="">Selecione...</option>' + dadosCongregacoes.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');
    document.getElementById('patCongregacao').innerHTML = opt;
    document.getElementById('transfDestino').innerHTML = opt;
}

document.getElementById('formLogin').onsubmit = (e) => {
    e.preventDefault();
    signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginSenha').value).catch(() => alert("Credenciais Inválidas"));
};

document.getElementById('formCongregacao').onsubmit = (e) => {
    e.preventDefault();
    push(congRef, { nome: document.getElementById('congNome').value });
    document.getElementById('formCongregacao').reset();
};

function renderizarCongregacoes() {
    document.getElementById('listaCongregacoes').innerHTML = dadosCongregacoes.map(c => `<tr class="border-bottom"><td>${c.nome}</td></tr>`).join('');
}

window.gerarEtiqueta = (id) => {
    const item = dadosPatrimonio.find(x => x.id === id);
    document.getElementById("qrcode").innerHTML = "";
    new QRCode(document.getElementById("qrcode"), { text: `ID:${item.id}`, width: 140, height: 140 });
    document.getElementById("printIgreja").innerText = item.congregacao.toUpperCase();
    document.getElementById("printItem").innerText = item.nome;
    setTimeout(() => { window.print(); }, 500);
};

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
