import os
import json
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

# Carrega as variáveis de ambiente locais (como VITE_SUPABASE_URL)
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

# Pega do .env (Seja padrão VITE_ ou genérico)
SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("VITE_SUPABASE_ANON_KEY") or os.environ.get("SUPABASE_KEY")

def chunked_iterable(iterable, size):
    """Gera blocos sequenciais do iterável com o tamanho especificado (para envio em massa)."""
    for i in range(0, len(iterable), size):
        yield iterable[i:i + size]

def clean_dict(d):
    """Limpa chaves vazias que a constraint do banco pode rejeitar (ex: timestamp de checkin)."""
    return {k: v for k, v in d.items() if v != "" and v is not None}

def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Erro: Credenciais do Supabase não encontradas no .env!")
        print("Certifique-se de configurar VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.")
        return

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Caminho onde os dados foram extraídos e transformados
    base_dir = Path(__file__).parent.parent / "DEV" / "HITS"

    # Itera sobre todas as pastas de hotéis
    for hotel_dir in base_dir.iterdir():
        if not hotel_dir.is_dir() or hotel_dir.name.startswith('_'):
            continue
            
        print(f"\n[Hotel] Processando: {hotel_dir.name}")
        
        for date_dir in hotel_dir.iterdir():
            if not date_dir.is_dir():
                continue
                
            print(f"  -> Lote / Pasta Data: {date_dir.name}")
            
            # ==========================================
            # 1. ATUALIZAÇÃO / INSERÇÃO DO HOTEL
            # ==========================================
            arq_hotel = date_dir / "table_hotel.json"
            hotel_id = None
            if arq_hotel.exists():
                with open(arq_hotel, 'r', encoding='utf-8') as f:
                    hotel_payload = json.load(f)
                    
                # Busca hotel_id se já existir
                res_h = supabase.table("hotel").select("id").eq("nome_fantasia", hotel_payload.get("nome_fantasia", "")).execute()
                
                if res_h.data:
                    hotel_id = res_h.data[0]["id"]
                    # Atualiza os cadastros básicos 
                    supabase.table("hotel").update(hotel_payload).eq("id", hotel_id).execute()
                else:
                    res_h = supabase.table("hotel").insert(hotel_payload).execute()
                    if res_h.data:
                        hotel_id = res_h.data[0]["id"]
            
            if not hotel_id:
                print("      Aviso: Hotel ignorado (sem table_hotel.json no lote ou erro ao criar).")
                continue

            # ==========================================
            # 2. BOLETIM DE OCUPACAO
            # ==========================================
            # O boletim atual agora e derivado de hotel_receita_diaria pela view
            # public.vw_boletim_ocupacao_atual. Este loader nao grava mais
            # public.boletim_ocupacao.

            # ==========================================
            # 3. RECEITA DIÁRIA (Revenues & Occupations)
            # ==========================================
            arq_receita = date_dir / "table_hotel_receita_diaria.json"
            if arq_receita.exists():
                with open(arq_receita, 'r', encoding='utf-8') as f:
                    receitas = json.load(f)
                
                if receitas:
                    # Limpa registros existentes desse hotel+extração
                    datas_ref = [r["data_referencia"] for r in receitas]
                    
                    for chunk_datas in chunked_iterable(datas_ref, 40):
                        supabase.table("hotel_receita_diaria") \
                            .delete() \
                            .eq("hotel_id", hotel_id) \
                            .eq("data_extracao", date_dir.name) \
                            .in_("data_referencia", chunk_datas) \
                            .execute()
                    
                    for r_chunk in chunked_iterable(receitas, 500):
                        for r in r_chunk:
                            r["hotel_id"] = hotel_id
                            r["data_extracao"] = date_dir.name
                        supabase.table("hotel_receita_diaria").insert(r_chunk).execute()
                    
                    print(f"      ✓ {len(receitas)} registros de Receita Diária carregados.")

if __name__ == "__main__":
    print("Iniciando extração em massa DEV/HITS -> SUPABASE...")
    main()
    print("Processamento concluído com sucesso!")
