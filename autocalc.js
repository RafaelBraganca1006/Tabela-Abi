/*
 * Cálculo automático da melhor nota do Abitur.
 *
 * Escolhe 36 dos 44 semestres maximizando a soma das notas, respeitando as
 * 12 regras da página. As regras dependem só de QUANTOS semestres de cada
 * matéria são usados, e dentro de uma matéria o melhor é sempre pegar as maiores
 * notas. Então basta enumerar a quantidade (0-4) por matéria (poucas
 * combinações, pois as matérias das 5 provas já ficam fixas em 4).
 */
(function () {
    'use strict';

    // Valor do <select> de prova -> nome da linha na tabela
    var SELECT_TO_ROW = {
        portugiesisch: 'Portugiesisch', englisch: 'Englisch', mathe: 'Mathe',
        geschi: 'Geschi', philosophie: 'Philosophie', physik: 'Physik',
        chemie: 'Chemie', biologie: 'Bio'
    };
    var ORDER = ['Deutsch', 'Portugiesisch', 'Englisch', 'Mathe', 'Geschi',
                 'Philosophie', 'Bio', 'Physik', 'Chemie', 'Musik/Kunst', 'Sport'];
    var TOTAL = 36;

    document.addEventListener('DOMContentLoaded', function () {
        var btn = document.getElementById('autocalc-btn');
        var hint = document.getElementById('autocalc-hint');
        var mainTable = document.querySelector('.info-section > .grades-table');
        if (!btn || !hint || !mainTable) return;

        var examSection = document.querySelector('.final-exams-section');
        var examSelects = Array.prototype.slice.call(examSection.querySelectorAll('.subject-select'));
        var examInputs = Array.prototype.slice.call(examSection.querySelectorAll('input[type="number"]'));

        // linhas da tabela principal: nome -> [{num, chk} x4]
        var rows = {};
        Array.prototype.forEach.call(mainTable.querySelectorAll('tbody tr'), function (tr) {
            var name = tr.querySelector('td').textContent.trim();
            rows[name] = Array.prototype.map.call(tr.querySelectorAll('.grade-cell'), function (c) {
                return { num: c.querySelector('input[type="number"]'), chk: c.querySelector('input[type="checkbox"]') };
            });
        });
        if (ORDER.some(function (n) { return !rows[n] || rows[n].length !== 4; })) return;

        function filled(input) { return input.value !== '' && !isNaN(parseInt(input.value, 10)); }

        function missing() {
            var m = { notas: 0, provas: 0, notasProvas: 0 };
            ORDER.forEach(function (n) { rows[n].forEach(function (c) { if (!filled(c.num)) m.notas++; }); });
            examSelects.forEach(function (s) { if (!s.value) m.provas++; });
            examInputs.forEach(function (i) { if (!filled(i)) m.notasProvas++; });
            return m;
        }

        function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

        var lastResult = '';
        function refresh() {
            var m = missing();
            var total = m.notas + m.provas + m.notasProvas;
            btn.disabled = total > 0;
            if (total === 0) {
                hint.textContent = lastResult || 'Tudo preenchido. Toque para escolher os 36 melhores semestres.';
                return;
            }
            lastResult = '';
            var parts = [];
            if (m.notas) parts.push(plural(m.notas, 'nota de semestre', 'notas de semestres'));
            if (m.provas) parts.push(plural(m.provas, 'prova para escolher', 'provas para escolher'));
            if (m.notasProvas) parts.push(plural(m.notasProvas, 'nota de prova', 'notas de provas'));
            hint.textContent = 'Faltam: ' + parts.join(' · ');
        }

        function solve() {
            var grades = {}, prefix = {}, order = {};
            ORDER.forEach(function (n) {
                var idx = [0, 1, 2, 3].sort(function (a, b) {
                    return parseInt(rows[n][b].num.value, 10) - parseInt(rows[n][a].num.value, 10) || a - b;
                });
                order[n] = idx;
                var p = [0];
                idx.forEach(function (i, k) { p[k + 1] = p[k] + parseInt(rows[n][i].num.value, 10); });
                prefix[n] = p;
                grades[n] = idx;
            });

            // matérias fixas em 4 semestres: Deutsch, Mathe (regra 3) e as das provas
            var forced = { 'Deutsch': 1, 'Mathe': 1 };
            examSelects.forEach(function (s) { forced[SELECT_TO_ROW[s.value]] = 1; });

            var counts = {}, best = null, bestSum = -1;

            function valid(c) {
                var sum = 0;
                ORDER.forEach(function (n) { sum += c[n]; });
                return sum === TOTAL &&
                    (c['Portugiesisch'] === 4 || c['Englisch'] === 4) &&                       // regra 2
                    c['Portugiesisch'] + c['Englisch'] + c['Bio'] + c['Physik'] + c['Chemie'] >= 14 && // regra 4
                    c['Geschi'] >= 2 &&                                                          // regra 5
                    c['Geschi'] + c['Philosophie'] >= 4 &&                                       // regra 6
                    c['Musik/Kunst'] >= 3 &&                                                     // regra 7
                    c['Sport'] <= 3;                                                             // regra 8
            }

            function rec(i, used) {
                if (used > TOTAL) return;
                if (i === ORDER.length) {
                    if (!valid(counts)) return;
                    var s = 0;
                    ORDER.forEach(function (n) { s += prefix[n][counts[n]]; });
                    if (s > bestSum) { bestSum = s; best = JSON.parse(JSON.stringify(counts)); }
                    return;
                }
                var n = ORDER[i];
                var opts = forced[n] ? [4] : [0, 1, 2, 3, 4];
                for (var k = 0; k < opts.length; k++) {
                    counts[n] = opts[k];
                    rec(i + 1, used + opts[k]);
                }
            }
            rec(0, 0);
            return best ? { counts: best, sum: bestSum, order: order } : null;
        }

        function setChecked(chk, value) {
            chk.checked = value;
            chk.dispatchEvent(new Event('change'));
        }

        btn.addEventListener('click', function () {
            if (btn.disabled) return;
            var res = solve();
            if (!res) {
                lastResult = '';
                hint.textContent = 'Não existe combinação de 36 semestres que cumpra todas as regras com essas provas. Tente escolher outras matérias para as provas.';
                return;
            }
            ORDER.forEach(function (n) {
                var chosen = res.order[n].slice(0, res.counts[n]);
                [0, 1, 2, 3].forEach(function (i) { setChecked(rows[n][i].chk, chosen.indexOf(i) !== -1); });
            });
            // dispara o recálculo de médias e notas finais já existente
            examInputs[0].dispatchEvent(new Event('input'));

            var values = document.querySelectorAll('.grade-value');
            var nc = values[3] ? values[3].textContent : '-';
            if (nc === '-') {
                lastResult = 'Melhor combinação aplicada (soma ' + res.sum + '), mas a regra de 25 pontos nas provas finais não foi atendida, então a nota final não pôde ser calculada.';
            } else {
                lastResult = 'Melhor combinação aplicada: soma ' + res.sum + ' nos 36 semestres. Nota final (NC): ' + nc + '.';
            }
            hint.textContent = lastResult;
            var target = document.querySelector('.grades-calculation-section');
            if (target && target.scrollIntoView) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });

        // Captura: eventos disparados via dispatchEvent (ex.: carregar tabela salva) não borbulham
        ['input', 'change'].forEach(function (ev) {
            document.addEventListener(ev, function (e) {
                if (e.target === btn) return;
                // edição manual invalida a mensagem do último cálculo
                if (!(e.isTrusted === false)) lastResult = '';
                refresh();
            }, true);
        });
        refresh();
    });
})();
