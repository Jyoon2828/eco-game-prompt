import { HABITATS, STYLES, FEATURE_EXAMPLES, REVISION_EXAMPLES, STORAGE_KEY, makeDefaultPlan, makeDefaultFeedback, normalizePlan, normalizeFeedback, habitatName, validatePlan, levelSchedule, makePrompt, finalPrompt, makeRevision, makeExamplePlan, makePlanFile, parsePlanFile } from './core.mjs';

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const steps = ['생태계 계획', '게임 규칙', '그림과 아이디어', '프롬프트 완성', '체험 후 수정'];
const state = { plan: makeDefaultPlan(), feedback: makeDefaultFeedback(), promptDraft: null, step: 0, errors: {} };
let saveTimer, toastTimer, dialogResolve;
const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';
const copyIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>';

function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3500);
}
function saveDraft() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...makePlanFile(state.plan, state.feedback, state.promptDraft), step: state.step }));
    $('saveState').textContent = '자동 저장됨';
    $('saveState').classList.add('saved');
  } catch {
    $('saveState').textContent = '계획 파일로 저장해 주세요';
    $('saveState').classList.remove('saved');
  }
}
function scheduleSave() {
  clearTimeout(saveTimer);
  $('saveState').textContent = '저장 중…';
  saveTimer = setTimeout(saveDraft, 250);
}
function loadDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!draft) return;
    const loaded = parsePlanFile(draft);
    state.plan = loaded.plan;
    state.feedback = loaded.feedback;
    state.promptDraft = loaded.promptDraft;
    state.step = Object.keys(validatePlan(state.plan)).length ? 0 : Math.min(4, Math.max(0, Number(draft.step) || 0));
    $('saveState').textContent = '이어서 작성하는 중';
    $('saveState').classList.add('saved');
  } catch { /* A broken or unavailable draft never prevents starting. */ }
}
function field(name, label, options = {}) {
  const value = state.plan[name] ?? '';
  const error = state.errors[name];
  const input = options.area
    ? `<textarea id="${name}" data-field="${name}" rows="${options.rows || 2}" maxlength="${options.max || 320}" placeholder="${esc(options.placeholder || '')}" ${error ? 'aria-invalid="true"' : ''} aria-describedby="${name}Help ${name}Error">${esc(value)}</textarea>`
    : `<input id="${name}" data-field="${name}" value="${esc(value)}" maxlength="${options.max || 160}" autocomplete="off" placeholder="${esc(options.placeholder || '')}" ${error ? 'aria-invalid="true"' : ''} aria-describedby="${name}Help ${name}Error">`;
  return `<div class="field ${options.full ? 'full' : ''} ${options.className || ''}"><label for="${name}">${label}${options.optional ? '<em>선택</em>' : ''}</label>${input}<p id="${name}Help" class="help-text" ${options.help ? '' : 'hidden'}>${esc(options.help || '')}</p><p id="${name}Error" class="field-error" ${error ? '' : 'hidden'}>${esc(error || '')}</p>${options.after || ''}</div>`;
}
function chipsFor(name, items) {
  return `<div class="chip-row"><span class="chip-lead">필요하면 선택해요</span>${items.map(t => `<button class="chip" data-add="${name}" data-value="${esc(t)}">+ ${esc(t)}</button>`).join('')}</div>`;
}
function heading(title, desc) {
  return `<div class="step-heading"><span class="small-label">STEP ${String(state.step + 1).padStart(2, '0')}</span><h1 id="stepTitle" tabindex="-1">${title}</h1><p>${desc}</p></div>`;
}
function choiceGroup(name, values, suffix) {
  return `<div class="choice-group" role="group" aria-label="${esc(name === 'duration' ? '게임 시간' : name === 'levelEvery' ? '레벨 상승 기준' : name === 'startInterval' ? '1레벨 등장 간격' : '5레벨 등장 간격')}">${values.map(v => `<button class="choice-button ${state.plan[name] === v ? 'selected' : ''}" data-set="${name}" data-value="${v}" aria-pressed="${state.plan[name] === v}">${v}${suffix}</button>`).join('')}</div>`;
}
function renderNav() {
  $('stepNav').innerHTML = steps.map((label, i) => `<button class="step-tab ${i === state.step ? 'current' : i < state.step ? 'done' : ''}" data-step="${i}" ${i === state.step ? 'aria-current="step"' : ''}><span class="step-number">${i < state.step ? '✓' : i + 1}</span><strong>${label}</strong></button>`).join('');
}
function renderSummary() {
  const p = state.plan;
  $('summaryName').textContent = p.gameName.trim() || '나만의 초록 게임';
  $('summaryPlace').textContent = `${habitatName(p) || '내가 고른 곳'} 생태계를 지키는 게임`;
  const rows = [['사는 생물', p.living || '아직 정하지 않았어요'], ['게임 시간', `${p.duration}초`], ['레벨 상승', `${p.levelEvery}개 수거할 때마다`], ['등장 간격', `${p.startInterval}초에서 ${p.endInterval}초로`], ['그림 분위기', STYLES[p.style].name]];
  $('summaryList').innerHTML = rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
  $('summaryMessage').textContent = p.message.trim() || '어떤 보전 방법을 알려 주고 싶나요?';
}
function renderStep(focus = false) {
  renderNav();
  renderSummary();
  const p = state.plan;
  let body = '';
  if (state.step === 0) {
    body = heading('어떤 곳을 지킬까요?', '게임의 무대와 생물을 정하고, 친구에게 전할 말을 적어요.') + `<div class="form-grid">
      ${field('gameName', '게임 이름', { max: 48, placeholder: '예: 하천 쓰레기 수색대' })}
      <div class="field"><label for="habitat">지키고 싶은 장소</label><select id="habitat" data-field="habitat">${Object.entries(HABITATS).map(([key, item]) => `<option value="${key}" ${p.habitat === key ? 'selected' : ''}>${item.name}</option>`).join('')}</select><div id="customHabitatWrap" class="custom-place" ${p.habitat === 'custom' ? '' : 'hidden'}><input id="customHabitat" data-field="customHabitat" value="${esc(p.customHabitat)}" maxlength="60" aria-label="직접 정한 장소" placeholder="내가 지키고 싶은 장소"><p id="customHabitatError" class="field-error" ${state.errors.customHabitat ? '' : 'hidden'}>${esc(state.errors.customHabitat || '')}</p></div></div>
      ${field('living', '그곳에 사는 생물', { placeholder: '생물 이름을 쉼표로 나누어 적어요.', after: `<div id="livingChips">${chipsFor('living', HABITATS[p.habitat].living)}</div>` })}
      ${field('trash', '게임에 등장할 쓰레기', { placeholder: '예: 페트병, 빈 캔, 과자 봉지', after: `<div id="trashChips">${chipsFor('trash', HABITATS[p.habitat].trash)}</div>` })}
      ${field('message', '친구에게 알려 줄 보전 방법과 이유', { full: true, area: true, placeholder: '예: 쓰레기를 줄이면 생물이 쓰레기를 먹거나 몸에 걸릴 위험을 줄일 수 있어요.', help: '어떤 행동이 생물에게 어떤 도움이 되는지 연결해 봐요.' })}
    </div>`;
  } else if (state.step === 1) {
    body = heading('어떻게 어려워질까요?', '쓰레기를 주울수록 레벨이 올라가고, 새 쓰레기가 더 자주 나타나요.') + `<div class="rule-grid">
      <div><div class="field-label">게임 시간</div>${choiceGroup('duration', [60, 90, 120], '초')}</div>
      <div><div class="field-label">레벨이 오르는 기준<span class="unit-note">수거 개수</span></div>${choiceGroup('levelEvery', [5, 8, 10], '개마다')}</div>
      <div><div class="field-label">1레벨의 쓰레기 등장 간격</div>${choiceGroup('startInterval', [3, 4, 5], '초마다')}</div>
      <div><div class="field-label">5레벨의 쓰레기 등장 간격</div>${choiceGroup('endInterval', [1.2, 1.6, 2], '초마다')}</div>
    </div><div class="level-title"><h2>내가 정한 레벨</h2><span>등장 간격이 짧을수록 더 자주 생겨요</span></div><div class="level-strip">${levelSchedule(p).map(r => `<div class="level-cell"><strong>${r.level}레벨</strong><b>${r.interval}<small style="display:inline;font-size:12px;margin-left:2px">초</small></b><small>${r.from}${r.to === null ? '개 이상' : `~${r.to}개 수거`}</small></div>`).join('')}</div><p class="rule-explanation">쓰레기가 쌓이면 오염도가 올라가요. 오염도가 100이 되지 않게 제한시간을 버티면 성공이에요.</p>`;
  } else if (state.step === 2) {
    const descriptions = { picture: ['✽', '따뜻하고 섬세한 자연 그림'], dimensional: ['◒', '부드러운 그림자와 입체감'], pixel: ['▦', '작은 네모로 표현한 게임'] };
    body = heading('나만의 재미를 넣어요', '그림 분위기를 고르고, 추가하고 싶은 기능을 직접 적어요.') + `<div class="field-label">그림 분위기</div><div class="style-options" role="group" aria-label="그림 분위기">${Object.entries(STYLES).map(([key, v]) => `<button class="style-option ${p.style === key ? 'selected' : ''}" data-style="${key}" aria-pressed="${p.style === key}"><span class="style-symbol" aria-hidden="true">${descriptions[key][0]}</span><strong>${v.name}</strong><small>${descriptions[key][1]}</small></button>`).join('')}</div>
      ${field('artNotes', '그림에 더 넣고 싶은 것', { optional: true, max: 300, placeholder: '예: 물결이 잔잔하게 움직이고 갈대가 흔들리면 좋겠어.' })}
      ${field('specialIdea', '나만의 특별한 기능', { optional: true, area: true, max: 600, className: 'idea-field', placeholder: '예: 쓰레기를 연속으로 주우면 보너스 점수를 받고 싶어.', after: `<div class="chip-row idea-examples"><span class="chip-lead">아이디어가 필요하면</span>${FEATURE_EXAMPLES.map((v, i) => `<button class="chip" data-feature="${i}">${v.title}</button>`).join('')}<button class="chip" data-feature="none">기본 게임으로</button></div>` })}`;
  } else if (state.step === 3) {
    body = heading('<span class="complete-dot" aria-hidden="true">✓</span>내 프롬프트가 완성됐어요', '문장을 쭉 읽어 보고 내 생각에 맞게 직접 고쳐요. 다 고쳤으면 최종 문장을 복사해 캔바 AI의 코드에 붙여 넣어요.') + `<label class="field-label prompt-label" for="promptOutput">캔바 AI에 입력할 문장<span class="edit-badge">직접 수정 가능</span></label><textarea id="promptOutput" class="prompt-output" maxlength="20000" spellcheck="false" aria-label="완성된 게임 제작 프롬프트" aria-describedby="promptEditHint"></textarea><p id="promptEditHint" class="output-note prompt-edit-hint"></p><div class="output-toolbar final-toolbar"><button class="button primary" data-action="copy-prompt">${copyIcon}최종 문장 복사</button><button class="button secondary" data-action="download-prompt">텍스트 저장</button><a class="button soft" href="https://www.canva.com/" target="_blank" rel="noopener noreferrer">캔바 열기 ${arrow}</a><button class="text-button regenerate-button" data-action="regenerate-prompt">계획으로 다시 만들기</button></div><p class="output-note">게임을 직접 해본 뒤에는 <strong>체험 후 수정</strong> 단계에서 고칠 내용을 적어요.</p>`;
  } else {
    const f = state.feedback;
    body = heading('친구가 해본 뒤 고쳐요', '바꾸고 싶은 점을 구체적으로 적으면 수정 요청 문장이 완성돼요.') + `<div class="chip-row" style="margin:-3px 0 16px"><span class="chip-lead">예시</span>${REVISION_EXAMPLES.map((v, i) => `<button class="chip" data-revision="${i}">${v.title}</button>`).join('')}</div><div class="revision-grid"><div>
      <div class="field"><label for="liked">잘된 점<em>선택</em></label><input id="liked" data-feedback="liked" value="${esc(f.liked)}" maxlength="400" placeholder="친구가 좋아한 점을 적어요."></div>
      <div class="field"><label for="problem">바꾸고 싶은 점</label><textarea id="problem" data-feedback="problem" rows="2" maxlength="400" placeholder="어떤 상황에서 무엇이 불편했나요?">${esc(f.problem)}</textarea></div>
      <div class="field"><label for="change">어떻게 바꾸고 싶나요?</label><textarea id="change" data-feedback="change" rows="2" maxlength="600" placeholder="예: 가장 빠른 등장 간격을 2초로 바꿔줘.">${esc(f.change)}</textarea></div>
    </div><div><label class="field-label" for="revisionOutput">캔바 AI에 이어서 입력할 문장</label><textarea id="revisionOutput" class="revision-output" readonly placeholder="왼쪽에 바꾸고 싶은 점과 바꿀 방법을 적어 주세요."></textarea><div class="revision-actions"><button class="button primary small" data-action="copy-revision">${copyIcon}수정 요청 복사</button><button class="button secondary small" data-action="download-revision">텍스트 저장</button></div><div class="field feedback-result"><label for="result">고친 뒤 달라진 점<em>선택</em></label><input id="result" data-feedback="result" value="${esc(f.result)}" maxlength="500" placeholder="다시 해보고 기록해요."></div></div></div>`;
  }
  $('stepContent').innerHTML = `<div class="step-body fade-in ${state.step === 4 ? 'revision-body' : ''}">${body}</div>`;
  $('backButton').disabled = state.step === 0;
  $('nextButton').innerHTML = ['게임 규칙 정하기', '그림과 아이디어', '프롬프트 완성하기', '체험 후 수정하기', '완성 문장 다시 보기'][state.step] + arrow;
  $('stepHint').textContent = ['내 생각을 먼저 적어요', '숫자를 바꾸면 난이도가 달라져요', '추가 기능은 없어도 괜찮아요', '읽기 → 직접 고치기 → 최종 복사', '고친 뒤 같은 부분을 다시 확인해요'][state.step];
  syncOutputs();
  if (focus) $('stepTitle').focus({ preventScroll: true });
}
function syncOutputs() {
  if ($('promptOutput')) {
    $('promptOutput').value = finalPrompt(state.plan, state.promptDraft);
    updatePromptControls();
  }
  if ($('revisionOutput')) {
    const output = makeRevision(state.plan, state.feedback);
    $('revisionOutput').value = output;
    document.querySelectorAll('[data-action="copy-revision"],[data-action="download-revision"]').forEach(b => b.disabled = !output);
  }
}
function updatePromptControls() {
  const output = finalPrompt(state.plan, state.promptDraft);
  document.querySelectorAll('[data-action="copy-prompt"],[data-action="download-prompt"]').forEach(b => b.disabled = !output.trim());
  const regenerate = document.querySelector('[data-action="regenerate-prompt"]');
  if (regenerate) regenerate.disabled = state.promptDraft === null;
  if ($('promptEditHint')) $('promptEditHint').textContent = state.promptDraft === null
    ? '문장을 읽고, 고치고 싶은 부분을 위에서 직접 수정해 보세요.'
    : '직접 고친 문장을 유지하고 있어요. 앞 단계의 계획을 다시 반영하려면 ‘계획으로 다시 만들기’를 눌러요.';
}
function clearFieldError(name) {
  delete state.errors[name];
  const error = $(name + 'Error');
  if (error) { error.hidden = true; error.textContent = ''; }
  const input = $(name);
  if (input) { input.classList.remove('invalid'); input.removeAttribute('aria-invalid'); }
}
function goStep(target) {
  if (target > 0) {
    const errors = validatePlan(state.plan);
    if (Object.keys(errors).length) {
      state.step = 0;
      state.errors = errors;
      renderStep();
      const first = $(Object.keys(errors)[0]);
      if (first) { first.classList.add('invalid'); first.focus(); }
      toast('먼저 나만의 생태계 계획을 적어 주세요.');
      return;
    }
  }
  state.step = Math.max(0, Math.min(4, target));
  state.errors = {};
  renderStep(true);
  scheduleSave();
}
async function copyText(text, outputId) {
  if (!text) return;
  let copied = false;
  const active = document.activeElement;
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); copied = true; } catch { /* Use selection fallback. */ }
  }
  if (!copied) {
    const area = document.createElement('textarea');
    area.className = 'copy-fallback';
    area.value = text;
    area.setAttribute('aria-hidden', 'true');
    document.body.append(area);
    area.focus(); area.select(); area.setSelectionRange(0, text.length);
    try { copied = document.execCommand('copy'); } catch { copied = false; }
    area.remove();
    if (active?.focus) active.focus({ preventScroll: true });
  }
  if (copied) toast('복사했어요. 캔바 AI의 코드에 붙여 넣어 보세요.');
  else {
    const output = $(outputId);
    output?.focus(); output?.select();
    toast('문장을 선택했어요. 길게 누르거나 Ctrl+C로 복사해 주세요.');
  }
}
function download(text, suffix, type = 'text/plain;charset=utf-8', extension = 'txt') {
  const name = (state.plan.gameName.trim() || '나의_생태계게임').replace(/[\\/:*?"<>|]/g, '-').slice(0, 50);
  const blob = new Blob([extension === 'txt' ? '\ufeff' + text : text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `${name}_${suffix}.${extension}`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}
function ask(title, description, accept = '계속하기') {
  if (typeof $('confirmDialog').showModal !== 'function') return Promise.resolve(window.confirm(description));
  $('dialogTitle').textContent = title;
  $('dialogDescription').textContent = description;
  $('acceptDialog').textContent = accept;
  $('confirmDialog').returnValue = '';
  $('confirmDialog').showModal();
  return new Promise(resolve => dialogResolve = resolve);
}
function hasContent() {
  return state.promptDraft !== null || ['gameName', 'living', 'trash', 'message', 'artNotes', 'specialIdea'].some(k => state.plan[k].trim()) || Object.values(state.feedback).some(v => v.trim());
}
function closeMenu() { $('fileMenu').hidden = true; $('menuButton').setAttribute('aria-expanded', 'false'); }

$('stepNav').addEventListener('click', e => { const b = e.target.closest('[data-step]'); if (b) goStep(Number(b.dataset.step)); });
$('homeButton').addEventListener('click', () => goStep(0));
$('backButton').addEventListener('click', () => goStep(state.step - 1));
$('nextButton').addEventListener('click', () => goStep(state.step === 4 ? 3 : state.step + 1));
$('stepContent').addEventListener('input', e => {
  const target = e.target;
  if (target.id === 'promptOutput') {
    state.promptDraft = target.value === makePrompt(state.plan) ? null : target.value;
    updatePromptControls(); scheduleSave();
  } else if (target.dataset.field && Object.hasOwn(state.plan, target.dataset.field)) {
    state.plan[target.dataset.field] = target.value;
    clearFieldError(target.dataset.field);
    renderSummary(); syncOutputs(); scheduleSave();
  } else if (target.dataset.feedback && Object.hasOwn(state.feedback, target.dataset.feedback)) {
    state.feedback[target.dataset.feedback] = target.value;
    syncOutputs(); scheduleSave();
  }
});
$('stepContent').addEventListener('change', e => {
  if (e.target.id === 'habitat') {
    state.plan.habitat = e.target.value;
    $('customHabitatWrap').hidden = state.plan.habitat !== 'custom';
    $('livingChips').innerHTML = chipsFor('living', HABITATS[state.plan.habitat].living);
    $('trashChips').innerHTML = chipsFor('trash', HABITATS[state.plan.habitat].trash);
    clearFieldError('customHabitat');
    renderSummary(); scheduleSave();
    if (state.plan.habitat === 'custom') $('customHabitat').focus();
  }
});
document.addEventListener('click', async e => {
  const b = e.target.closest('button');
  if (!b) { if (!e.target.closest('.header-tools')) closeMenu(); return; }
  if (b.dataset.add) {
    const name = b.dataset.add;
    const parts = state.plan[name].split(/[,，、]/).map(t => t.trim()).filter(Boolean);
    if (!parts.includes(b.dataset.value)) parts.push(b.dataset.value);
    state.plan[name] = parts.join(', ').slice(0, 160);
    $(name).value = state.plan[name]; clearFieldError(name);
    renderSummary(); scheduleSave();
  } else if (b.dataset.set) {
    state.plan[b.dataset.set] = Number(b.dataset.value);
    renderStep();
    document.querySelector(`[data-set="${b.dataset.set}"][data-value="${b.dataset.value}"]`)?.focus({ preventScroll: true });
    scheduleSave();
  } else if (b.dataset.style) {
    state.plan.style = b.dataset.style;
    renderStep();
    document.querySelector(`[data-style="${b.dataset.style}"]`)?.focus({ preventScroll: true });
    scheduleSave();
  } else if (b.dataset.feature) {
    const next = b.dataset.feature === 'none' ? '' : FEATURE_EXAMPLES[Number(b.dataset.feature)].text;
    if (state.plan.specialIdea.trim() && next !== state.plan.specialIdea && !await ask('특별한 기능을 바꿀까요?', '지금 적은 특별한 기능을 선택한 내용으로 바꿉니다.', '바꾸기')) return;
    state.plan.specialIdea = next;
    $('specialIdea').value = next;
    $('specialIdea').focus({ preventScroll: true });
    scheduleSave();
  } else if (b.dataset.revision) {
    const example = REVISION_EXAMPLES[Number(b.dataset.revision)];
    if ((state.feedback.problem.trim() || state.feedback.change.trim()) && !await ask('수정 예시로 바꿀까요?', '지금 적은 바꾸고 싶은 점과 바꿀 방법을 선택한 예시로 바꿉니다.', '예시 사용')) return;
    state.feedback.problem = example.problem; state.feedback.change = example.change;
    $('problem').value = example.problem; $('change').value = example.change;
    syncOutputs(); scheduleSave();
  } else if (b.dataset.action) {
    closeMenu();
    switch (b.dataset.action) {
      case 'copy-prompt': await copyText(finalPrompt(state.plan, state.promptDraft), 'promptOutput'); break;
      case 'download-prompt': download(finalPrompt(state.plan, state.promptDraft), '제작프롬프트'); break;
      case 'regenerate-prompt':
        if (state.promptDraft !== null && await ask('계획으로 문장을 다시 만들까요?', '직접 고친 문장을 지우고, 앞 단계에서 정한 계획으로 문장을 다시 만듭니다. 필요하면 먼저 텍스트로 저장해 주세요.', '다시 만들기')) {
          state.promptDraft = null;
          syncOutputs(); saveDraft(); $('promptOutput').focus(); toast('지금 계획으로 문장을 다시 만들었어요.');
        } break;
      case 'copy-revision': await copyText(makeRevision(state.plan, state.feedback), 'revisionOutput'); break;
      case 'download-revision': download(makeRevision(state.plan, state.feedback), '수정프롬프트'); break;
      case 'export-plan': download(JSON.stringify(makePlanFile(state.plan, state.feedback, state.promptDraft), null, 2), '게임계획', 'application/json;charset=utf-8', 'json'); toast('계획 파일을 저장했어요. 다음에 불러와 이어 쓸 수 있어요.'); break;
      case 'import-plan': $('planFileInput').click(); break;
      case 'reset':
        if (await ask('새 게임을 계획할까요?', '지금 작성한 내용을 지우고 처음부터 시작합니다. 필요하면 먼저 계획 파일로 저장해 주세요.', '새로 만들기')) {
          state.plan = makeDefaultPlan(); state.feedback = makeDefaultFeedback(); state.promptDraft = null; state.step = 0; state.errors = {};
          renderStep(true); saveDraft(); toast('새로운 게임 계획을 시작해요.');
        } break;
    }
  }
  if (!b.closest('.header-tools')) closeMenu();
});
$('exampleButton').addEventListener('click', async () => {
  if (hasContent() && !await ask('예시 계획을 불러올까요?', '지금 적은 내용을 ‘하천 쓰레기 수색대’ 예시로 바꿉니다. 필요하면 먼저 계획 파일을 저장해 주세요.', '예시로 채우기')) return;
  state.plan = makeExamplePlan(); state.feedback = makeDefaultFeedback(); state.promptDraft = null; state.step = 0; state.errors = {};
  renderStep(true); saveDraft(); toast('예시를 채웠어요. 내 아이디어로 바꿔 보세요.');
});
$('menuButton').addEventListener('click', () => {
  $('fileMenu').hidden = !$('fileMenu').hidden;
  $('menuButton').setAttribute('aria-expanded', String(!$('fileMenu').hidden));
});
$('cancelDialog').addEventListener('click', () => $('confirmDialog').close('cancel'));
$('acceptDialog').addEventListener('click', () => $('confirmDialog').close('accept'));
$('confirmDialog').addEventListener('close', () => { dialogResolve?.($('confirmDialog').returnValue === 'accept'); dialogResolve = null; });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
$('planFileInput').addEventListener('change', async () => {
  const file = $('planFileInput').files?.[0];
  if (!file) return;
  try {
    if (file.size > 100_000) throw new Error('계획 파일이 너무 큽니다. 이 앱에서 저장한 파일을 선택해 주세요.');
    const loaded = parsePlanFile(JSON.parse(await file.text()));
    if (hasContent() && !await ask('저장한 계획을 불러올까요?', '현재 작성 중인 내용을 선택한 파일의 계획으로 바꿉니다.', '불러오기')) return;
    state.plan = loaded.plan; state.feedback = loaded.feedback; state.promptDraft = loaded.promptDraft; state.step = 0; state.errors = {};
    renderStep(true); saveDraft(); toast('저장한 계획을 불러왔어요.');
  } catch (error) { toast(error instanceof SyntaxError ? '계획 파일을 읽을 수 없어요. 이 앱에서 저장한 JSON 파일을 선택해 주세요.' : error.message); }
  finally { $('planFileInput').value = ''; }
});
window.addEventListener('pagehide', () => { clearTimeout(saveTimer); saveDraft(); });
loadDraft();
renderStep();
