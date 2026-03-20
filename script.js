import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getDatabase, ref, set, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-database.js";

// 1. COLE SEU firebaseConfig AQUI (Pegue no console do Firebase)
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

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const patrimonioRef = ref(db, 'patrimonio');

// Elementos
const form = document.getElementById('formPatrimonio');
const listaTabela = document.getElementById('listaPatrimonio');

let dadosGlobais = []; // Cache local para busca/filtros

// 2. ESCUTAR MUDANÇAS NO BANCO (Tempo Real)
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

// 3. SALVAR OU ATUALIZAR
form.onsubmit = async (e) => {
    e.preventDefault();
    const idEdicao = document.getElementById('editId').value;
    const inputFoto = document.getElementById('fotoItem');
    
    let fotoBase64 = idEdicao ? (dadosGlobais.find(i => i.id == idEdicao).foto || "") : "";
    if (inputFoto.files[0]) {
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
    form.reset();
};

// 4. REMOVER
window.removerItem = (id) => {
    if (confirm("Apagar da nuvem?")) remove(ref(db, `patrimonio/${id}`));
};

// 5. EDITAR (Prepara form)
window.prepararEdicao = (id) => {
    const item = dadosGlobais.find(i => i.id == id);
    document.getElementById('editId').value = id;
    document.getElementById('nomeItem').value = item.nome;
    document.getElementById('valorItem').value = item.valor;
    document.getElementById('congregacao').value = item.congregacao;
    document.getElementById('obsItem').value = item.obs || "";
    document.getElementById('tituloForm').innerText = "Editando Online";
    document.getElementById('btnCancelar').classList.remove('d-none');
};

window.cancelarEdicao = () => {
    document.getElementById('editId').value = "";
    document.getElementById('tituloForm').innerText = "Cadastrar Novo Bem";
    document.getElementById('btnCancelar').classList.add('d-none');
    form.reset();
};

// Lógica de Redução de Imagem (igual à anterior)
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

function renderizarTabela(dados) {
    listaTabela.innerHTML = '';
    dados.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><img src="${item.foto || ''}" class="img-patrimonio"></td>
            <td><strong>${item.nome}</strong><br><small>${item.obs || ''}</small></td>
            <td>${item.congregacao}</td>
            <td>R$ ${item.valor.toFixed(2)}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="prepararEdicao('${item.id}')">✏️</button>
                <button class="btn btn-sm btn-outline-danger" onclick="removerItem('${item.id}')">🗑️</button>
            </td>
        `;
        listaTabela.appendChild(tr);
    });
}

window.filtrarItens = () => {
    const busca = document.getElementById('buscaNome').value.toLowerCase();
    const f = dadosGlobais.filter(i => i.nome.toLowerCase().includes(busca));
    renderizarTabela(f);
};
