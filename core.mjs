export const SCHEMA_VERSION = 1;
export const STORAGE_KEY = 'eco-game-prompt-studio-v1';
export const HABITATS = {
  river: { name: '하천', living: ['물고기', '개구리', '잠자리'], trash: ['페트병', '빈 캔', '과자 봉지'] },
  coast: { name: '바닷가', living: ['갈매기', '게', '조개'], trash: ['페트병', '비닐봉지', '플라스틱 뚜껑'] },
  forest: { name: '숲', living: ['다람쥐', '딱따구리', '나비'], trash: ['음료수 캔', '과자 봉지', '종이컵'] },
  garden: { name: '학교 화단', living: ['나비', '벌', '꽃'], trash: ['과자 봉지', '페트병', '비닐봉지'] },
  wetland: { name: '습지', living: ['왜가리', '개구리', '잠자리'], trash: ['비닐봉지', '페트병', '빈 캔'] },
  custom: { name: '직접 정하기', living: [], trash: ['페트병', '빈 캔', '과자 봉지'] },
};
export const STYLES = {
  picture: { name: '자연관찰 그림책', description: '식물과 생물을 섬세하고 따뜻한 그림책 일러스트로 표현해줘.' },
  dimensional: { name: '부드러운 입체 일러스트', description: '부드러운 입체감과 자연스러운 그림자가 있는 2.5D 일러스트로 표현해줘.' },
  pixel: { name: '픽셀 게임', description: '생물과 사물을 알아볼 수 있는 정교하고 일관된 픽셀 아트로 표현해줘.' },
};
export const FEATURE_EXAMPLES = [
  { title: '도움말', text: '도움말 버튼을 누르면 아직 남은 쓰레기 한 개의 주변이 반짝이게 해줘. 한 게임에서 3번 사용할 수 있게 해줘.' },
  { title: '잠깐 천천히', text: '느리게 버튼을 누르면 5초 동안 새 쓰레기의 등장 간격이 2배로 길어지게 해줘. 5초 뒤 원래 간격으로 돌아오고, 한 게임에서 2번만 사용할 수 있게 해줘.' },
  { title: '연속 수거 보너스', text: '3초 안에 쓰레기 3개를 연속으로 주우면 보너스 20점을 줘. 보너스를 준 뒤 연속 수거 횟수는 다시 0부터 세게 해줘.' },
];
export const REVISION_EXAMPLES = [
  { title: '너무 빨라요', problem: '높은 레벨에서 쓰레기가 너무 빨리 나타나서 누르기 어려워.', change: '5레벨의 쓰레기 등장 간격을 2초로 바꿔줘.' },
  { title: '그림이 겹쳐요', problem: '쓰레기와 생물이 겹쳐서 무엇을 눌러야 할지 잘 안 보여.', change: '생물과 쓰레기가 서로 겹치지 않게 배치하고, 쓰레기를 누를 수 있는 영역을 크게 해줘.' },
  { title: '점수가 두 번 올라요', problem: '쓰레기 한 개를 눌렀는데 점수가 두 번 올라가.', change: '쓰레기 한 개는 한 번만 수거되고 점수도 한 번만 올라가게 고쳐줘.' },
];

export function makeDefaultPlan() {
  return { gameName: '', habitat: 'river', customHabitat: '', living: '', trash: '', message: '', duration: 60, levelEvery: 5, startInterval: 3, endInterval: 1.2, style: 'picture', artNotes: '', specialIdea: '' };
}
export function makeDefaultFeedback() {
  return { liked: '', problem: '', change: '', result: '' };
}
const clean = (v, max = 500) => typeof v === 'string' ? v.slice(0, max).replace(/\u0000/g, '') : '';
const choice = (v, values, fallback) => values.includes(v) ? v : fallback;
export function normalizePlan(raw = {}) {
  const d = makeDefaultPlan();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return d;
  return {
    gameName: clean(raw.gameName, 48),
    habitat: Object.hasOwn(HABITATS, raw.habitat) ? raw.habitat : d.habitat,
    customHabitat: clean(raw.customHabitat, 60),
    living: clean(raw.living, 160), trash: clean(raw.trash, 160), message: clean(raw.message, 320),
    duration: choice(Number(raw.duration), [60, 90, 120], d.duration),
    levelEvery: choice(Number(raw.levelEvery), [5, 8, 10], d.levelEvery),
    startInterval: choice(Number(raw.startInterval), [3, 4, 5], d.startInterval),
    endInterval: choice(Number(raw.endInterval), [1.2, 1.6, 2], d.endInterval),
    style: Object.hasOwn(STYLES, raw.style) ? raw.style : d.style,
    artNotes: clean(raw.artNotes, 300), specialIdea: clean(raw.specialIdea, 600),
  };
}
export function normalizeFeedback(raw = {}) {
  const f = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return { liked: clean(f.liked, 400), problem: clean(f.problem, 400), change: clean(f.change, 600), result: clean(f.result, 500) };
}
export function habitatName(plan) {
  return plan.habitat === 'custom' ? plan.customHabitat.trim() : HABITATS[plan.habitat].name;
}
export function validatePlan(plan) {
  const errors = {};
  if (!plan.gameName.trim()) errors.gameName = '게임 이름을 적어 주세요.';
  if (!habitatName(plan)) errors.customHabitat = '지키고 싶은 장소를 적어 주세요.';
  if (!plan.living.trim()) errors.living = '그곳에 사는 생물을 적어 주세요.';
  if (!plan.trash.trim()) errors.trash = '게임에 나올 쓰레기를 적어 주세요.';
  if (!plan.message.trim()) errors.message = '친구에게 알려 주고 싶은 보전 방법을 적어 주세요.';
  return errors;
}
export function levelSchedule(plan) {
  const weights = [0, 0.28, 0.56, 0.78, 1];
  return weights.map((weight, index) => ({
    level: index + 1,
    from: index * plan.levelEvery,
    to: index === 4 ? null : (index + 1) * plan.levelEvery - 1,
    interval: Math.round((plan.startInterval - (plan.startInterval - plan.endInterval) * weight) * 10) / 10,
  }));
}
export function makePrompt(plan) {
  const schedule = levelSchedule(plan);
  const levels = schedule.map(r => `- 레벨 ${r.level}: 누적 ${r.from}${r.to === null ? '개 이상' : `~${r.to}개`}, ${r.interval}초마다 새 쓰레기 생성`).join('\n');
  return `초등학교 4학년 과학 ‘생물과 환경’에서 배운 내용으로 생태계 보전 게임을 만들어줘.

게임 제목: ${plan.gameName.trim()}
배경: ${habitatName(plan)}
등장하는 생물: ${plan.living.trim()}
수거할 쓰레기: ${plan.trash.trim()}
이곳에 버려진 쓰레기를 주워 생태계를 지키는 게임이야.

[게임 방법]
- 게임 시간은 ${plan.duration}초로 해줘.
- 시작할 때 쓰레기 3개를 놓고, 이후에도 여러 위치에 무작위로 새 쓰레기가 계속 나타나게 해줘.
- 쓰레기를 누르면 해당 쓰레기가 사라지고 10점과 수거 개수 1개가 올라가게 해줘. 같은 쓰레기를 여러 번 계산하지 않게 해줘.
- 화면에 남은 쓰레기는 최대 10개로 해줘. 10개이면 생성을 잠시 멈추고, 수거해서 자리가 생기면 다시 생성해줘.
- 생물은 어울리는 장소에 배치하고, 쓰레기와 생물이 겹쳐 가려지지 않게 해줘.
- 생물을 누르면 이름과 짧은 설명을 보여줘. 생물을 누르는 행동은 점수와 오염도에 영향을 주지 않게 해줘.

[점점 어려워지는 규칙]
- 레벨은 1부터 시작해서 최대 5까지 올라가게 해줘.
- 누적 수거 개수에 따라 아래 레벨과 등장 간격을 적용해줘.
${levels}
- 레벨이 올라가면 ‘레벨 업!’을 잠깐 보여줘. 안내가 쓰레기를 누르는 것을 가리지 않게 해줘.

[오염도와 성공 조건]
- 오염도는 0에서 시작하고 0~100 사이로 표시해줘.
- 2초마다 화면에 남아 있는 쓰레기 개수만큼 오염도를 올려줘.
- 쓰레기를 하나 주우면 오염도를 2 내려줘.
- 제한시간 동안 오염도가 100이 되지 않도록 지키면 성공이야.
- 그전에 오염도가 100이 되면 게임을 끝내고 다시 도전할 수 있게 해줘.
- 게임이 끝나거나 일시정지하면 남은 시간, 쓰레기 생성, 오염도 변화를 모두 멈춰줘. 이어하기를 누르면 겹치는 타이머 없이 이어가게 해줘.
- 다시 하기를 누르면 기존 쓰레기와 효과를 지우고 시간, 점수, 수거 개수, 레벨, 오염도를 처음 상태로 돌려줘.

[그림과 나만의 아이디어]
- ${STYLES[plan.style].description}
- 배경, 생물, 쓰레기의 화풍을 통일하고 대상을 정확하게 알아볼 수 있는 그림으로 표현해줘.
- 생물과 쓰레기를 배경 속에 놓인 것처럼 보여줘. 이름표는 대상을 눌렀을 때 나타나게 해줘.
- 쓰레기를 주우면 작은 반짝임과 ‘+10’을 잠깐 보여줘.
${plan.artNotes.trim() ? `- 그림에 추가할 내용: ${plan.artNotes.trim()}\n` : ''}- 나만의 특별한 기능: ${plan.specialIdea.trim() || '추가 기능 없이 기본 게임으로 만들어줘.'}

[화면과 학습 메시지]
- 태블릿 가로 화면에서 스크롤 없이 게임하고, 손가락으로 쉽게 누를 수 있도록 글씨와 버튼, 누르는 영역을 크게 해줘.
- 남은 시간, 레벨, 점수, 오염도를 한눈에 보여줘.
- 시작하기, 일시정지, 이어하기, 다시 하기 버튼을 넣어줘.
- 결과 화면에 점수, 주운 쓰레기 수, 도달한 레벨을 보여줘.
- 마지막에 ‘${plan.message.trim()}’라는 생태계 보전 메시지를 보여줘.
- 오염도는 게임을 위해 정한 가상의 수치이며 실제 생태계의 회복에는 시간과 지속적인 노력이 필요하다는 안내를 넣어줘.

모든 안내 문장을 자연스러운 한국어로 다듬어줘.`;
}
export function makeRevision(plan, feedback) {
  if (!feedback.problem.trim() || !feedback.change.trim()) return '';
  return `‘${plan.gameName.trim() || '생태계 보전 게임'}’ 게임을 직접 해보고 친구의 의견을 들었어.
${feedback.liked.trim() ? `잘된 점은 ‘${feedback.liked.trim()}’이야.\n` : ''}
직접 해보니 ‘${feedback.problem.trim()}’이라는 점을 바꾸고 싶어.
다음과 같이 수정해줘: ${feedback.change.trim()}

요청한 부분을 중심으로 고치고 다른 게임 규칙과 기록 방식은 유지해줘.
게임 시작, 일시정지, 이어하기, 게임 종료, 다시 하기가 수정 후에도 제대로 작동하게 해줘.
수정한 내용을 쉬운 말로 짧게 알려줘.`;
}
export function makeExamplePlan() {
  return { ...makeDefaultPlan(), gameName: '하천 쓰레기 수색대', living: '물고기, 개구리, 잠자리', trash: '페트병, 빈 캔, 과자 봉지', message: '쓰레기를 줍고 덜 만들면 생물이 쓰레기를 먹거나 몸에 걸릴 위험을 줄일 수 있어요.', specialIdea: FEATURE_EXAMPLES[0].text };
}
export function finalPrompt(plan, promptDraft = null) {
  return typeof promptDraft === 'string' ? promptDraft : makePrompt(plan);
}
function normalizePromptDraft(value) {
  return typeof value === 'string' ? clean(value, 20_000) : null;
}
export function makePlanFile(plan, feedback, promptDraft = null) {
  return { app: 'eco-game-prompt-studio', schemaVersion: SCHEMA_VERSION, savedAt: new Date().toISOString(), plan, feedback, promptDraft: normalizePromptDraft(promptDraft) };
}
export function parsePlanFile(raw) {
  if (!raw || typeof raw !== 'object' || raw.app !== 'eco-game-prompt-studio' || raw.schemaVersion !== SCHEMA_VERSION || !raw.plan || typeof raw.plan !== 'object' || Array.isArray(raw.plan)) throw new Error('이 앱에서 저장한 계획 파일을 선택해 주세요.');
  return { plan: normalizePlan(raw.plan), feedback: normalizeFeedback(raw.feedback), promptDraft: normalizePromptDraft(raw.promptDraft) };
}
