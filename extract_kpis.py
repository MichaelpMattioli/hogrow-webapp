# -*- coding: utf-8 -*-
import json
from datetime import datetime
import pandas as pd

# Configuracoes iniciais
ARQUIVO_JSON = r'c:\Projetos\Hogrow\ANALISYS\notebooks\data of scrapping.json'
TOTAL_UHS = 100 # PLACHOLDER: edite este valor depois

def extrair_kpis():
    with open(ARQUIVO_JSON, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    resultados = []
    
    for dia_report in data.get('Report', []):
        group_str = dia_report.get('Group', '')
        if not group_str.startswith('Auditoria: '):
            continue
            
        data_str = group_str.replace('Auditoria: ', '').strip()
        
        try:
            data_dt = datetime.strptime(data_str, '%d/%m/%Y')
            dias_semana_pt = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom']
            dia_semana = dias_semana_pt[data_dt.weekday()]
        except ValueError:
            dia_semana = '-'
            
        rec_total = dia_report.get('DailyAmount', 0.0)
        rec_diarias = dia_report.get('DailyAmountMinusAAndBAmount', 0.0)
        
        dailies_posted = dia_report.get('DailiesPosted', [])
        ocupados = len(dailies_posted)
        
        # Ignorar dias que a lista veio vazia (sem auditoria batida ainda)
        if ocupados == 0 and rec_total == 0:
            continue
            
        # Consideramos cortesia quem tem valor 0
        cortesia = sum(1 for dp in dailies_posted if dp.get('DailyAmountMinusAAndBAmount', 0.0) <= 0)
        
        quartos_pagantes = ocupados - cortesia
        diaria_media = (rec_diarias / quartos_pagantes) if quartos_pagantes > 0 else 0
        
        occ_pct = (ocupados / TOTAL_UHS) if TOTAL_UHS > 0 else 0
        revpar = (rec_diarias / TOTAL_UHS) if TOTAL_UHS > 0 else 0
        
        resultados.append({
            'Data': data_str,
            'Sem.': dia_semana,
            'Rec. Total': rec_total,
            'Rec. Diárias': rec_diarias,
            'Occ%': f"{occ_pct:.1%}",
            'Ocupados': ocupados,
            'Cortesia': cortesia,
            'Revpar': round(revpar, 2),
            'Diaria Média': round(diaria_media, 2)
        })
        
    return resultados

kpis = extrair_kpis()
df = pd.DataFrame(kpis)
print(df.to_string(index=False))
