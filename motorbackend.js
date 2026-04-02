// ==========================================
// motorbackend.js
// CONEXÃO OFICIAL COM O SUPABASE (SCHEMA: CARTEIRA)
// ARQUITETURA: ERP-FIRST com OVERRIDE MANUAL e EXIBIÇÃO TOTAL
// ==========================================

let supabase;

(async () => {
  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
    
    const supabaseUrl = 'https://clbpujmdjbywbuevhyhg.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsYnB1am1kamJ5d2J1ZXZoeWhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyOTA3NTUsImV4cCI6MjA4OTg2Njc1NX0.3vwMm8mLEcg9nPzH2uyrB65mzxN_NMvvaLSn2OxKAxo';
    
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log("✅ Motor Supabase engatado com sucesso!");
  } catch (e) {
    console.error("❌ Falha na ignição do Supabase:", e);
  }
})();

async function getDb() {
  while (!supabase) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return supabase;
}

const ITENS_ORDEM = ["BBA/ELET.", "MT", "FLUT.", "M FV.", "AD. FLEX", "AD. RIG.", "FIXADORES", "SIST. ELÉT.", "PEÇAS REP.", "SERV.", "MONT.", "FATUR."];

function getSafeId(str) { 
  if (!str) return "";
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '_');
}

const motorBackend = {

  sincronizarEFetch: async function() {
    const db = await getDb();
    
    // Traz absolutamente TUDO da view/tabela ERP
    const { data: erpData, error: erpError } = await db.schema('carteira').from('carteira_obras')
      .select('*')
      .order('data_abertura', { ascending: false });
      
    if (erpError) throw new Error("Erro DB ERP: " + erpError.message);

    // Traz operações manuais feitas no painel
    const { data: frontData, error: frontError } = await db.schema('carteira').from('obras_front').select('*');
    if (frontError) throw new Error("Erro DB Front: " + frontError.message);

    const mapaFront = {};
    if (frontData) {
      frontData.forEach(f => { mapaFront[String(f.obra).trim()] = f; });
    }

    const resultado = [
      ["DATA", "OBRA", "CLIENTE", "VALOR", "DIAS PRAZO", ...ITENS_ORDEM, "OBSERVAÇÕES", "DETALHES_JSON", "CPMV", "ITEM", "CATEGORIA"]
    ];

    if (erpData) {
      erpData.forEach(erp => {
        const numObra = String(erp.obra).trim();
        if(!numObra) return;

        const f = mapaFront[numObra] || {}; 
        const valorERP = erp.pv !== null ? erp.pv : (erp.financeiro !== null ? erp.financeiro : "0");

        // Lógica automática para definir o STATUS DA PROPOSTA
        let statusProposta = "ENVIADAS";
        const etapaUp = String(erp.etapa || '').toUpperCase();
        
        if (erp.data_frustrada) {
            statusProposta = "FRUSTRADAS";
        } else if (etapaUp.includes('CONCLU') || erp.data_faturamento) {
            statusProposta = "CONCLUIDAS";
        } else if (etapaUp.includes('ENTREGUE')) {
            statusProposta = "ENTREGUES";
        } else if (erp.data_firmada) {
            statusProposta = "FIRMADAS";
        }

        // Anexando os dados para as duas visualizações! (Firmadas e Visão Geral)
        resultado.push([
          f.data_entrada_orig || erp.data_firmada || "", // 0: DATA FIRMADA
          numObra, // 1
          f.cliente || erp.cliente || "", // 2
          f.valor || valorERP || "", // 3
          f.dias_prazo || erp.prazo || "", // 4
          f.it_1 || "N/A", f.it_2 || "N/A", f.it_3 || "N/A", f.it_4 || "N/A", f.it_5 || "N/A", f.it_6 || "N/A",
          f.it_7 || "N/A", f.it_8 || "N/A", f.it_9 || "N/A", f.it_10 || "N/A", f.it_11 || "N/A", f.it_12 || "N/A",
          f.analise || "", // 17
          f.detalhes_json ? JSON.stringify(f.detalhes_json) : "{}", // 18
          erp.cpmv || 0, // 19
          erp.item || "", // 20
          erp.categoria || "", // 21
          
          // INFORMAÇÕES EXTRAS PARA VISUALIZAÇÃO GERAL E FRUSTRADAS
          statusProposta, // 22: STATUS GERAL DA PROPOSTA
          erp.data_abertura || "", // 23
          erp.segmento || "", // 24
          erp.responsavel || "", // 25
          erp.complexidade || "", // 26
          erp.uf || "", // 27
          erp.etapa || "", // 28
          erp.nf || "", // 29
          erp.data_frustrada || "", // 30
          erp.data_enviada || "", // 31
          erp.data_faturamento || "" // 32
        ]);
      });
    }

    if (frontData) {
       frontData.forEach(f => {
          const numObra = String(f.obra).trim();
          const jaExisteNoERP = erpData.some(erp => String(erp.obra).trim() === numObra);
          if (!jaExisteNoERP && numObra) {
             resultado.push([
                f.data_entrada_orig || "", numObra, f.cliente || "", f.valor || "", f.dias_prazo || "",
                f.it_1 || "N/A", f.it_2 || "N/A", f.it_3 || "N/A", f.it_4 || "N/A", f.it_5 || "N/A", f.it_6 || "N/A",
                f.it_7 || "N/A", f.it_8 || "N/A", f.it_9 || "N/A", f.it_10 || "N/A", f.it_11 || "N/A", f.it_12 || "N/A",
                f.analise || "", f.detalhes_json ? JSON.stringify(f.detalhes_json) : "{}",
                0, "", "", 
                "FIRMADAS", "", "", "", "", "", "", "", "", "", "" // Fillers para obras manuais puras
             ]);
          }
       });
    }

    return resultado;
  },
  
  salvarProjeto: async function(obj) {
    const db = await getDb();
    const payload = {
      obra: obj.obra, data_entrada_orig: obj.data_entrada_orig, cliente: obj.cliente, valor: obj.valor, dias_prazo: obj.dias_prazo,
      analise: obj.analise, detalhes_json: obj.detalhes_json,
      it_1: obj[getSafeId(ITENS_ORDEM[0])] || "N/A", it_2: obj[getSafeId(ITENS_ORDEM[1])] || "N/A", it_3: obj[getSafeId(ITENS_ORDEM[2])] || "N/A",
      it_4: obj[getSafeId(ITENS_ORDEM[3])] || "N/A", it_5: obj[getSafeId(ITENS_ORDEM[4])] || "N/A", it_6: obj[getSafeId(ITENS_ORDEM[5])] || "N/A",
      it_7: obj[getSafeId(ITENS_ORDEM[6])] || "N/A", it_8: obj[getSafeId(ITENS_ORDEM[7])] || "N/A", it_9: obj[getSafeId(ITENS_ORDEM[8])] || "N/A",
      it_10: obj[getSafeId(ITENS_ORDEM[9])] || "N/A", it_11: obj[getSafeId(ITENS_ORDEM[10])] || "N/A", it_12: obj[getSafeId(ITENS_ORDEM[11])] || "N/A"
    };

    const { error } = await db.schema('carteira').from('obras_front').upsert(payload, { onConflict: 'obra' });
    if (error) throw new Error(error.message);
    return "✅ Obra gravada com sucesso!";
  },
  
  getResumoGeralObra: async function(numObra) {
    const db = await getDb();
    const { data, error } = await db.schema('carteira').from('carteira_obras').select('*').eq('obra', numObra).single();
    if (error || !data) return { encontrado: false };
    
    return {
      encontrado: true,
      dados: [
        { label: "DATA ABERTURA", valor: data.data_abertura || "-" },
        { label: "OBRA", valor: data.obra || "-" },
        { label: "CLIENTE", valor: data.cliente || "-" },
        { label: "ITEM", valor: data.item || "-" },
        { label: "CATEGORIA", valor: data.categoria || "-" },
        { label: "COMPL.", valor: data.etapa || "-" }, 
        { label: "UF", valor: data.uf || "-" },
        { label: "DATA FIRMADA", valor: data.data_firmada || "-" },
        { label: "P. TOTAL", valor: data.pv !== null ? data.pv : (data.financeiro !== null ? data.financeiro : "0") },
        { label: "RECEB.", valor: data.recebido !== null ? data.recebido : "0" },
        { label: "A RECEB", valor: data.a_receber !== null ? data.a_receber : "0" }
      ]
    };
  },
  
  getDadosGeralSimplificado: async function(numObra) {
    const db = await getDb();
    const { data, error } = await db.schema('carteira').from('carteira_obras').select('*').eq('obra', numObra).single();
    if (error || !data) return null;
    
    return {
      cliente: data.cliente || "-", item: data.item || "", categoria: data.categoria || "",
      valor: data.pv !== null ? data.pv : (data.financeiro !== null ? data.financeiro : "0"),
      prazo: data.prazo || "30", dataFirmada: data.data_firmada || ""
    };
  },
  
  excluirObra: async function(numObra) {
    const db = await getDb();
    const { error } = await db.schema('carteira').from('obras_front').delete().eq('obra', numObra);
    if (error) throw new Error(error.message);
    return "🗑️ Edições operacionais removidas.";
  }
};

window.motorBackend = motorBackend;