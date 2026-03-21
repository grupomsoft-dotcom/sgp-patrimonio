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

// Referências
const patRef = ref(db, 'patrimonio');
const congRef = ref(db, 'congregacoes');
const histRef = ref(db, 'historico');
const userAccessRef = ref(db, 'usuarios_acesso');

let dadosPatrimonio = [], dadosCongregacoes = [], dadosUsuarios = [];
let html5QrCode, itemParaMoverID = null;
let perfilUsuario = null; // Guardará o nível de acesso

// --- CONTROLE DE ACESSO ---
onAuthStateChanged(auth, user => {
    if (user) {
        verificarPerfil(user);
    } else {
        document.getElementById('telaLogin').style.display = 'flex';
        document.getElementById('sistemaConteudo').style.display = 'none';
    }
});

function verificarPerfil(user) {
    onValue(userAccessRef, snap => {
        const usuarios = snap.val() || {};
        const lista = Object.values(usuarios);
        
        // Procura se o email logado está na lista de dirigentes
        perfilUsuario = lista.find(u => u.email === user.email);

        // Se não achar na lista, mas for o e-mail do dono/admin principal
        if (user.email === "grupomsoft@gmail.com" || (perfilUsuario && perfilUsuario.nivel === 'admin')) {
            perfilUsuario = { nivel: 'admin', nome: 'Administrador' };
            document.getElementById('menuAdminOnly').style.display = 'block';
        } else if (perfilUsuario) {
            document.getElementById('menuAdminOnly').style.display = 'none';
        } else {
            alert("Acesso Negado. Procure o Administrador.");
            fazerLogout();
            return;
        }

        document.getElementById('infoUser').innerText = `Logado como: ${perfilUsuario.congregacao || perfilUsuario.nome}`;
        document.getElementById('telaLogin').style.display = 'none';
        document.getElementById('sistemaConteudo').style.display = 'block';
        carregarDados();
    });
}

// --- CARREGAMENTO FILTRADO ---
function carregarDados() {
    onValue(congRef, snap => {
        const val = snap.val();
        dadosCongregacoes = val ? Object.keys(val).map(k => ({ id: k, ...val[k] })) : [];
        renderizarCongregacoes();
        atualizarSelects();
    });
    onValue(patRef, snap => {
        const val = snap.val();
        let lista = val ? Object.keys(val).map(k => ({ id: k, ...val[k] })) : [];
        
        // FILTRO DE CONGREGAÇÃO: Se for dirigente, só vê o dele
        if (perfilUsuario.nivel !== 'admin') {
            lista = lista.filter(i => i.congregacao === perfilUsuario.congregacao);
        }
        
        dadosPatrimonio = lista;
        renderizarPatrimonio(dadosPatrimonio);
    });
    onValue(histRef, snap => {
        const val = snap.val();
        let hist = val ? Object.keys(val).map(k => ({ id: k, ...val[k] })) : [];
        if (perfilUsuario.nivel !== 'admin') {
            hist = hist.filter(h => h.origem === perfilUsuario.congregacao || h.destino === perfilUsuario.congregacao);
        }
        renderizarHistorico(hist);
    });
    onValue(userAccessRef, snap => {
        const val = snap.val();
        dadosUsuarios = val ? Object.keys(val).map(k => ({ id: k, ...val[k] })) : [];
        renderizarUsuarios();
    });
}

// --- RENDERIZAÇÃO ---
function renderizarPatrimonio(dados) {
    document.getElementById('listaPatrimonio').innerHTML = dados.map(i => `
        <tr>
            <td><img src="${i.foto || ''}" class="img-preview me-2"><strong>${i.nome}</strong></td>
            <td><span class="badge bg-light text-dark border">${i.congregacao}</span></td>
            <td>
                <button class="btn btn-sm btn-light" onclick="gerarEtiqueta('${i.id}')"><i class="fas fa-print"></i></button>
                ${perfilUsuario.nivel === 'admin' ? `
                    <button class="btn btn-sm btn-light text-primary" onclick="editaPat('${i.id}')"><i class="fas fa-pen"></i></button>
                    <button class="btn btn-sm btn-light text-danger" onclick="confirmarExclusao('${i.id}')"><i class="fas fa-trash"></i></button>
                ` : ''}
            </td>
        </tr>`).join('');
}

function renderizarCongregacoes() {
    document.getElementById('listaCongregacoes').innerHTML = dadosCongregacoes.map(c => `<tr><td>${c.nome}</td><td class="text-end">${perfilUsuario.nivel==='admin' ? `<button class="btn btn-sm text-danger" onclick="excluirCong('${c.id}')">X</button>` : ''}</td></tr>`).join('');
}

function renderizarHistorico(dados) {
    document.getElementById('listaHistoricoGlobal').innerHTML = dados.slice().reverse().map(h => `
        <div class="small p-2 mb-1 bg-light rounded border-start border-primary border-4">${h.data}: <b>${h.itemName}</b> (${h.origem} ➔ ${h.destino})</div>
    `).join('');
}

function renderizarUsuarios() {
    const lista = document.getElementById('listaUsuarios');
    if(lista) {
        lista.innerHTML = dadosUsuarios.map(u => `<tr><td>${u.email}</td><td>${u.congregacao}</td><td><button class="btn btn-sm text-danger" onclick="removerAcesso('${u.id}')">X</button></td></tr>`).join('');
    }
}

// --- SCANNER & TRANSFERIR ---
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
    if(!item) return alert("Item não encontrado ou você não tem acesso a ele!");
    itemParaMoverID = id;
    document.getElementById('formMoverArea').classList.remove('d-none');
    document.getElementById('moverNomeItem').innerText = item.nome;
    document.getElementById('moverLocalAtual').innerText = item.congregacao;
}

window.executarTransferenciaPagina = () => {
    const dest = document.getElementById('transfDestinoFinal').value;
    const item = dadosPatrimonio.find(x => x.id === itemParaMoverID);
    if(!dest || dest === item.congregacao) return alert("Destino inválido!");
    push(histRef, { itemId: itemParaMoverID, itemName: item.nome, origem: item.congregacao, destino: dest, data: new Date().toLocaleString('pt-br') });
    update(ref(db, `patrimonio/${itemParaMoverID}`), { congregacao: dest }).then(() => {
        alert("Sucesso!");
        document.getElementById('formMoverArea').classList.add('d-none');
    });
};

// --- FUNÇÕES DE ADMIN ---
window.fazerLogout = () => signOut(auth);

document.getElementById('formCongregacao').onsubmit = e => {
    e.preventDefault();
    const nome = document.getElementById('congNome').value;
    if(nome) push(congRef, { nome });
    e.target.reset();
};

document.getElementById('formUsuario').onsubmit = e => {
    e.preventDefault();
    const email = document.getElementById('userEmail').value;
    const congregacao = document.getElementById('userCong').value;
    push(userAccessRef, { email, congregacao, nivel: 'dirigente' });
    e.target.reset();
};

window.removerAcesso = (id) => remove(ref(db, `usuarios_acesso/${id}`));

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

document.getElementById('formPatrimonio').onsubmit = async e => {
    e.preventDefault();
    const item = { 
        congregacao: document.getElementById('patCongregacao').value, 
        nome: document.getElementById('patNome').value, 
        serie: document.getElementById('patSerie').value || "", 
        valor: parseFloat(document.getElementById('patValor').value), 
        data: new Date().toLocaleDateString('pt-br'), 
        foto: "" 
    };
    const file = document.getElementById('patFoto').files[0];
    if (file) item.foto = await reduzirImagem(file);
    push(patRef, item); e.target.reset();
};

document.getElementById('formLogin').onsubmit = e => {
    e.preventDefault();
    signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginSenha').value);
};

// --- AUXILIARES ---
function atualizarSelects() {
    const opt = '<option value="">Selecione...</option>' + dadosCongregacoes.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');
    document.getElementById('patCongregacao').innerHTML = opt;
    document.getElementById('editCongregacao').innerHTML = opt;
    document.getElementById('transfDestinoFinal').innerHTML = opt;
    document.getElementById('userCong').innerHTML = opt;
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

// REGISTRO PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
}
