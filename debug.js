const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;

async function debugFBRef() {
    try {
        console.log('=== DEBUG FBREF STRUCTURE ===\n');
        
        const response = await axios.get('https://fbref.com/en/comps/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            },
            timeout: 15000
        });
        
        const $ = cheerio.load(response.data);
        
        // Salvar HTML para análise
        await fs.writeFile('debug-page.html', response.data, 'utf8');
        console.log('HTML salvo em debug-page.html');
        
        console.log(`Status: ${response.status}`);
        console.log(`Tamanho HTML: ${response.data.length} caracteres\n`);
        
        // Verificar estrutura geral
        console.log('=== ESTRUTURA GERAL ===');
        console.log(`Total de tabelas: ${$('table').length}`);
        console.log(`Total de divs: ${$('div').length}`);
        console.log(`Total de comentários: ${response.data.match(/<!--/g)?.length || 0}\n`);
        
        // IDs de interesse
        const targetIds = [
            'comps_club',
            'comps_1_fa_club_league_senior',
            'comps_2_fa_club_league_senior',
            'comps_3_fa_club_league_senior'
        ];
        
        console.log('=== TABELAS DE INTERESSE ===');
        for (const id of targetIds) {
            console.log(`\n--- ${id} ---`);
            
            // Verificar tabela direta
            const directTable = $(`#${id}`);
            console.log(`Tabela direta: ${directTable.length > 0 ? 'ENCONTRADA' : 'NÃO ENCONTRADA'}`);
            
            // Verificar container
            const container = $(`#all_${id}`);
            console.log(`Container all_${id}: ${container.length > 0 ? 'ENCONTRADO' : 'NÃO ENCONTRADO'}`);
            
            if (container.length > 0) {
                const comments = container.contents().filter(function() {
                    return this.type === 'comment';
                });
                console.log(`Comentários no container: ${comments.length}`);
                
                if (comments.length > 0) {
                    comments.each(function(i) {
                        const commentData = this.data;
                        console.log(`  Comentário ${i + 1}: ${commentData.length} chars`);
                        
                        // Verificar se o comentário contém uma tabela
                        if (commentData.includes('<table') && commentData.includes(id)) {
                            console.log(`    ✓ Contém tabela ${id}`);
                            
                            // Analisar estrutura da tabela no comentário
                            const commentSoup = cheerio.load(commentData);
                            const tableInComment = commentSoup(`#${id}`);
                            if (tableInComment.length > 0) {
                                const rows = tableInComment.find('tbody tr').length;
                                console.log(`    ✓ ${rows} linhas na tabela`);
                                
                                // Mostrar uma amostra de dados
                                tableInComment.find('tbody tr').slice(0, 3).each((idx, row) => {
                                    const $row = commentSoup(row);
                                    
                                    // Analisar estrutura do país
                                    const countryTd = $row.find('td[data-stat="country"]');
                                    const countryLinks = countryTd.find('a');
                                    
                                    let country = '';
                                    if (countryLinks.length >= 2) {
                                        country = countryLinks.eq(1).text().trim();
                                    } else if (countryLinks.length === 1) {
                                        const linkText = countryLinks.eq(0).text().trim();
                                        const matches = linkText.match(/[A-Z]{3}/);
                                        country = matches ? matches[0] : linkText;
                                    }
                                    
                                    const league = $row.find('th[data-stat="league_name"] a').text().trim();
                                    const countryHtml = countryTd.html();
                                    
                                    if (country && league) {
                                        console.log(`    Amostra ${idx + 1}: ${country} - ${league}`);
                                        console.log(`      HTML país: ${countryHtml}`);
                                        console.log(`      Links encontrados: ${countryLinks.length}`);
                                        if (countryLinks.length > 0) {
                                            countryLinks.each((i, link) => {
                                                console.log(`        Link ${i + 1}: "${commentSoup(link).text().trim()}"`);
                                            });
                                        }
                                    }
                                });
                            }
                        }
                    });
                }
            }
            
            // Verificar outras variações
            const variations = [
                `table_${id}`,
                `${id}_table`,
                `div_${id}`,
                `wrapper_${id}`
            ];
            
            for (const variation of variations) {
                const element = $(`#${variation}`);
                if (element.length > 0) {
                    console.log(`  Variação encontrada: ${variation}`);
                }
            }
        }
        
        // Procurar por padrões nas tabelas existentes
        console.log('\n=== ANÁLISE DE TABELAS EXISTENTES ===');
        $('table').each((i, table) => {
            const $table = $(table);
            const id = $table.attr('id');
            const classes = $table.attr('class');
            
            if (id || classes) {
                console.log(`Tabela ${i + 1}: id="${id || 'sem id'}" class="${classes || 'sem class'}"`);
                
                // Verificar se tem dados de liga
                const hasCountryData = $table.find('td[data-stat="country"]').length > 0;
                const hasLeagueData = $table.find('th[data-stat="league_name"]').length > 0;
                
                if (hasCountryData && hasLeagueData) {
                    console.log(`  ✓ Contém dados de país e liga!`);
                    const rows = $table.find('tbody tr').length;
                    console.log(`  ✓ ${rows} linhas de dados`);
                }
            }
        });
        
        // Procurar por divs que podem conter tabelas
        console.log('\n=== DIVS COM POSSÍVEL CONTEÚDO DE TABELA ===');
        $('div[id*="comp"]').each((i, div) => {
            const $div = $(div);
            const id = $div.attr('id');
            console.log(`Div relacionada: ${id}`);
        });
        
        console.log('\n=== DEBUG CONCLUÍDO ===');
        console.log('Verifique o arquivo debug-page.html para análise manual');
        
    } catch (error) {
        console.error('Erro no debug:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Headers:', error.response.headers);
        }
    }
}

if (require.main === module) {
    debugFBRef();
}

module.exports = debugFBRef;