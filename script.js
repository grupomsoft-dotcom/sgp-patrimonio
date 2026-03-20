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

let dadosPatrimonio = [];
let dadosCongregacoes = [];
let html5QrCode;

// --- CONTROLE DE ACESSO ---
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
        atualizarSelectCongregacoes();
    });
    onValue(patRef, (snap) => {
        const val = snap.val();
        dadosPatrimonio = val ? Object.keys(val).map(k => ({ id: k, ...val[k] })) : [];
        renderizarPatrimonio(dadosPatrimonio);
        atualizarDashboard();
    });
}

// --- SCANNER DE QR CODE ---
window.abrirScanner = () => {
    const modal = new bootstrap.Modal(document.getElementById('modalScanner'));
    modal.show();
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
            // Supondo que o texto seja "ID:XXXX"
            if (decodedText.startsWith("ID:")) {
                const idExtraido = decodedText.split("ID:")[1].split("\n")[0];
                pararScanner();
                modal.hide();
                editaPat(idExtraido); // Abre o item para edição
                alert("Item identificado!");
            }
        }
    ).catch(err => console.error("Erro na câmara", err));
};

window.pararScanner = () => {
    if (html5QrCode) {
        html5QrCode.stop().then(() => html5QrCode.clear());
    }
};

// --- GESTÃO DE PATRIMÔNIO ---
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
    if (id) update(ref(db, `patrimonio/${id}`), item);
    else push(patRef, item);
    resetaPatrimonio();
};

function renderizarPatrimonio(dados) {
    const tbody = document.getElementById('listaPatrimonio');
    tbody.innerHTML = dados.map(i => `
        <tr>
            <td><img src="${i.foto || ''}" class="img-preview"></td>
            <td><strong>${i.nome}</strong><br><small class="text-muted">ID: ${i.id.substring(0,6)}</small></td>
            <td>${i.congregacao}</td>
            <td>R$ ${i.valor.toFixed(2)}</td>
            <td>
                <button class="btn btn-sm btn-outline-info" onclick="gerarEtiqueta('${i.id}')">🏷️</button>
                <button class="btn btn-sm btn-link" onclick="editaPat('${i.id}')">✏️</button>
                <button class="btn btn-sm btn-link text-danger" onclick="apagaPat('${i.id}')">🗑️</button>
            </td>
        </tr>
    `).join('');
}

window.editaPat = (id) => {
    const i = dadosPatrimonio.find(x => x.id === id);
    if(!i) { alert("Item não encontrado!"); return; }
    document.getElementById('patId').value = id;
    document.getElementById('patNome').value = i.nome;
    document.getElementById('patValor').value = i.valor;
    document.getElementById('patCongregacao').value = i.congregacao;
    document.getElementById('patObs').value = i.obs || "";
    document.getElementById('btnCancelaPat').classList.remove('d-none');
    document.getElementById('btnSalvarPat').innerText = "Atualizar Item";
    window.scrollTo(0,0);
};

// --- GERAÇÃO DE ETIQUETA ---
window.gerarEtiqueta = (id) => {
    const item = dadosPatrimonio.find(x => x.id === id);
    document.getElementById("qrcode").innerHTML = "";
    new QRCode(document.getElementById("qrcode"), {
        text: `ID:${item.id}\nITEM:${item.nome}`,
        width: 140, height: 140
    });
    document.getElementById("printIgreja").innerText = item.congregacao.toUpperCase();
    document.getElementById("printItem").innerText = item.nome;
    document.getElementById("printData").innerText = "Cadastrado em: " + item.data;
    setTimeout(() => { window.print(); }, 500);
};

// --- FUNÇÕES DE APOIO ---
function atualizarDashboard() {
    let total = 0, unidades = {};
    dadosPatrimonio.forEach(i => { total += i.valor; unidades[i.congregacao] = (unidades[i.congregacao] || 0) + i.valor; });
    document.getElementById('dashItens').innerText = dadosPatrimonio.length;
    document.getElementById('dashValor').innerText = total.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });
    let topU = "--", max = 0;
    for(let u in unidades) { if(unidades[u] > max) { max = unidades[u]; topU = u; } }
    document.getElementById('dashUnidade').innerText = topU;
}

function atualizarSelectCongregacoes() {
    const select = document.getElementById('patCongregacao');
    select.innerHTML = '<option value="">Selecione...</option>' + dadosCongregacoes.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');
}

window.resetaPatrimonio = () => { document.getElementById('formPatrimonio').reset(); document.getElementById('patId').value = ""; document.getElementById('btnCancelaPat').classList.add('d-none'); document.getElementById('btnSalvarPat').innerText = "Salvar Item"; };
window.apagaPat = (id) => confirm("Apagar item?") && remove(ref(db, `patrimonio/${id}`));
window.fazerLogout = () => signOut(auth);

document.getElementById('formLogin').onsubmit = (e) => {
    e.preventDefault();
    signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginSenha').value).catch(() => alert("Acesso negado."));
};

// Aba Congregações (Simples)
document.getElementById('formCongregacao').onsubmit = (e) => {
    e.preventDefault();
    const id = document.getElementById('congId').value;
    const d = { nome: document.getElementById('congNome').value, responsavel: document.getElementById('congResponsavel').value, local: document.getElementById('congLocal').value };
    if (id) update(ref(db, `congregacoes/${id}`), d); else push(congRef, d);
    document.getElementById('formCongregacao').reset();
};
function renderizarCongregacoes() {
    document.getElementById('listaCongregacoes').innerHTML = dadosCongregacoes.map(c => `<tr><td>${c.nome}</td><td>${c.responsavel}</td><td>${c.local}</td><td><button class="btn btn-sm btn-link text-danger" onclick="apagaCong('${c.id}')">🗑️</button></td></tr>`).join('');
}
window.apagaCong = (id) => confirm("Excluir?") && remove(ref(db, `congregacoes/${id}`));

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
