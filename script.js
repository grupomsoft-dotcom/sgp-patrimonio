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

// --- LOGICA DE TRANSFERÊNCIA ---
window.abrirModalTransferir = () => {
    const modalTransf = new bootstrap.Modal(document.getElementById('modalTransferir'));
    modalTransf.show();
};

window.confirmarTransferencia = () => {
    const novoDestino = document.getElementById('transfDestino').value;
    const item = dadosPatrimonio.find(x => x.id === itemSelecionadoId);
    
    if (novoDestino === item.congregacao) return alert("O item já está nesta unidade!");

    const log = {
        itemId: itemSelecionadoId,
        itemName: item.nome,
        origem: item.congregacao,
        destino: novoDestino,
        data: new Date().toLocaleString('pt-br')
    };

    // 1. Grava no Histórico
    push(histRef, log);
    // 2. Atualiza a Unidade do Item
    update(ref(db, `patrimonio/${itemSelecionadoId}`), { congregacao: novoDestino });

    bootstrap.Modal.getInstance(document.getElementById('modalTransferir')).hide();
    bootstrap.Modal.getInstance(document.getElementById('modalView')).hide();
    alert("Transferência realizada com sucesso!");
};

// --- RENDERIZAÇÃO DE HISTÓRICOS ---
function renderizarHistoricoGlobal() {
    const container = document.getElementById('listaHistoricoGlobal');
    container.innerHTML = dadosHistorico.slice().reverse().map(h => `
        <div class="timeline-item">
            <small class="text-primary">${h.data}</small><br>
            <strong>${h.itemName}</strong> movido de <em>${h.origem}</em> para <strong>${h.destino}</strong>
        </div>
    `).join('');
}

window.exibirPopupItem = (id) => {
    const item = dadosPatrimonio.find(x => x.id === id);
    itemSelecionadoId = id;
    
    document.getElementById('viewFoto').src = item.foto || 'https://via.placeholder.com/300?text=Sem+Foto';
    document.getElementById('viewNome').innerText = item.nome;
    document.getElementById('viewCongregacao').innerText = item.congregacao;
    document.getElementById('viewValor').innerText = item.valor.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });
    
    // Filtra histórico específico deste item
    const histItem = dadosHistorico.filter(h => h.itemId === id).reverse();
    document.getElementById('viewTimeline').innerHTML = histItem.length ? histItem.map(h => `
        <div class="small mb-2 border-bottom pb-1">
            <span class="text-muted">${h.data.split(' ')[0]}:</span> ${h.origem} ➔ ${h.destino}
        </div>
    `).join('') : '<p class="text-muted small">Sem movimentações anteriores.</p>';

    new bootstrap.Modal(document.getElementById('modalView')).show();
};

// --- FUNÇÕES DE INTERFACE ---
window.abrirScanner = () => {
    const modalScanner = new bootstrap.Modal(document.getElementById('modalScanner'));
    modalScanner.show();
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (text) => {
        if (text.startsWith("ID:")) {
            pararScanner(); modalScanner.hide();
            exibirPopupItem(text.split("ID:")[1].split("\n")[0]);
        }
    });
};

function atualizarSelects() {
    const options = '<option value="">Selecione...</option>' + dadosCongregacoes.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');
    document.getElementById('patCongregacao').innerHTML = options;
    document.getElementById('transfDestino').innerHTML = options;
}

// ... (Cadastros, Dashboard e Redução de Imagem - Mesma lógica da versão 3.6) ...

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

function renderizarPatrimonio(dados) {
    document.getElementById('listaPatrimonio').innerHTML = dados.map(i => `
        <tr>
            <td><img src="${i.foto || ''}" class="img-preview" onclick="exibirPopupItem('${i.id}')" style="cursor:pointer"></td>
            <td><strong>${i.nome}</strong></td>
            <td>${i.congregacao}</td>
            <td>R$ ${i.valor.toFixed(2)}</td>
            <td>
                <button class="btn btn-sm btn-outline-info" onclick="gerarEtiqueta('${i.id}')">🏷️</button>
                <button class="btn btn-sm btn-link" onclick="editaPat('${i.id}')">✏️</button>
            </td>
        </tr>`).join('');
}

window.editaPat = (id) => {
    const i = dadosPatrimonio.find(x => x.id === id);
    document.getElementById('patId').value = id;
    document.getElementById('patNome').value = i.nome;
    document.getElementById('patValor').value = i.valor;
    document.getElementById('patCongregacao').value = i.congregacao;
    document.getElementById('patObs').value = i.obs || "";
    document.getElementById('btnCancelaPat').classList.remove('d-none');
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

function atualizarDashboard() {
    let total = 0, unidades = {};
    dadosPatrimonio.forEach(i => { total += i.valor; unidades[i.congregacao] = (unidades[i.congregacao] || 0) + i.valor; });
    document.getElementById('dashItens').innerText = dadosPatrimonio.length;
    document.getElementById('dashValor').innerText = total.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });
    let topU = "--", max = 0;
    for(let u in unidades) { if(unidades[u] > max) { max = unidades[u]; topU = u; } }
    document.getElementById('dashUnidade').innerText = topU;
}

window.resetaPatrimonio = () => { document.getElementById('formPatrimonio').reset(); document.getElementById('patId').value = ""; document.getElementById('btnCancelaPat').classList.add('d-none'); };
window.fazerLogout = () => signOut(auth);
window.pararScanner = () => html5QrCode && html5QrCode.stop().then(() => html5QrCode.clear());

document.getElementById('formLogin').onsubmit = (e) => {
    e.preventDefault();
    signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginSenha').value).catch(() => alert("Acesso negado."));
};

document.getElementById('formCongregacao').onsubmit = (e) => {
    e.preventDefault();
    push(congRef, { nome: document.getElementById('congNome').value });
    document.getElementById('formCongregacao').reset();
};

function renderizarCongregacoes() {
    document.getElementById('listaCongregacoes').innerHTML = dadosCongregacoes.map(c => `<tr><td>${c.nome}</td></tr>`).join('');
}

window.gerarEtiqueta = (id) => {
    const item = dadosPatrimonio.find(x => x.id === id);
    document.getElementById("qrcode").innerHTML = "";
    new QRCode(document.getElementById("qrcode"), { text: `ID:${item.id}`, width: 140, height: 140 });
    document.getElementById("printIgreja").innerText = item.congregacao.toUpperCase();
    document.getElementById("printItem").innerText = item.nome;
    document.getElementById("printData").innerText = "Patrimônio ID: " + item.id.substring(0,6);
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
