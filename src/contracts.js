import { SCHEMA_IDS } from './constants.js';
import { clamp, clone, isRecord, makeId, sanitizeName } from './utils.js';

export function createDefaultRole(name = '目标角色') {
  const id = makeId('role');
  return {
    schema: SCHEMA_IDS.rolePack,
    id,
    name: sanitizeName(name),
    summary: '',
    persona: '',
    avatarAssetId: null,
    variables: {
      core: {
        favor: 0,
        suspicion: 0,
        hypnosis: { active: [], permanent: [] },
        profile: {},
      },
      custom: {},
    },
    worldbookFragments: [],
    provenance: { source: 'manual', importedAt: new Date().toISOString() },
  };
}

export function createDefaultState(regionPack) {
  const now = new Date();
  return {
    schema: SCHEMA_IDS.state,
    revision: 1,
    region: regionPack.id,
    time: {
      year: now.getFullYear(),
      date: regionPack.defaultDate,
      weekday: regionPack.weekdays[0],
      clock: '08:00',
      scheduleLabel: regionPack.defaultScheduleLabel,
      specialDate: '',
    },
    location: { current: regionPack.locations[0]?.name || '未设定地点', custom: [] },
    timetable: clone(regionPack.timetable),
    resources: {
      mcEnergy: 25,
      mcEnergyMax: 25,
      mcPoints: 0,
      money: regionPack.currency.initial,
      suspicion: 0,
    },
    roles: {},
    inventory: [],
    tasks: [],
    achievements: [],
    work: [],
    dispatches: [],
    hypnosis: { commands: [], activeEffects: [] },
    operationQueue: [],
    custom: {},
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeState(value, regionPack) {
  const base = createDefaultState(regionPack);
  const source = isRecord(value) ? value : {};
  const resources = isRecord(source.resources) ? source.resources : {};
  const state = {
    ...base,
    ...clone(source),
    schema: SCHEMA_IDS.state,
    revision: Math.max(1, Number(source.revision) || 1),
    time: { ...base.time, ...(isRecord(source.time) ? source.time : {}) },
    location: { ...base.location, ...(isRecord(source.location) ? source.location : {}) },
    resources: {
      ...base.resources,
      ...resources,
      mcEnergy: clamp(resources.mcEnergy ?? base.resources.mcEnergy, 0, 1_000_000),
      mcEnergyMax: clamp(resources.mcEnergyMax ?? base.resources.mcEnergyMax, 1, 1_000_000),
      mcPoints: clamp(resources.mcPoints ?? base.resources.mcPoints, 0, 1_000_000_000),
      money: clamp(resources.money ?? base.resources.money, 0, 1_000_000_000_000),
      suspicion: clamp(resources.suspicion ?? base.resources.suspicion, 0, 100),
    },
    roles: isRecord(source.roles) ? source.roles : {},
    timetable: Array.isArray(source.timetable) ? source.timetable : base.timetable,
    inventory: Array.isArray(source.inventory) ? source.inventory : [],
    tasks: Array.isArray(source.tasks) ? source.tasks : [],
    achievements: Array.isArray(source.achievements) ? source.achievements : [],
    work: Array.isArray(source.work) ? source.work : [],
    dispatches: Array.isArray(source.dispatches) ? source.dispatches : [],
    operationQueue: Array.isArray(source.operationQueue) ? source.operationQueue : [],
    custom: isRecord(source.custom) ? source.custom : {},
    updatedAt: new Date().toISOString(),
  };
  state.resources.mcEnergy = Math.min(state.resources.mcEnergy, state.resources.mcEnergyMax);
  return state;
}

export function normalizeRolePack(input) {
  if (!isRecord(input)) throw new Error('角色包必须是 JSON 对象');
  const name = sanitizeName(input.name || input.data?.name || input.character?.name, '未命名角色');
  const role = createDefaultRole(name);
  const sourceVariables = isRecord(input.variables) ? input.variables : {};
  return {
    ...role,
    ...clone(input),
    schema: SCHEMA_IDS.rolePack,
    id: String(input.id || role.id),
    name,
    summary: String(input.summary || input.data?.description || input.description || ''),
    persona: String(input.persona || input.data?.personality || input.personality || ''),
    avatarAssetId: input.avatarAssetId ? String(input.avatarAssetId) : null,
    variables: {
      core: isRecord(sourceVariables.core) ? sourceVariables.core : role.variables.core,
      custom: isRecord(sourceVariables.custom) ? sourceVariables.custom : {},
    },
    worldbookFragments: Array.isArray(input.worldbookFragments) ? input.worldbookFragments : [],
    provenance: isRecord(input.provenance) ? input.provenance : role.provenance,
  };
}

export function normalizeProfile(input, region = 'cn') {
  const source = isRecord(input) ? input : {};
  return {
    schema: SCHEMA_IDS.profile,
    id: String(source.id || makeId('profile')),
    name: sanitizeName(source.name, '默认配置'),
    region: ['cn', 'jp', 'custom'].includes(source.region) ? source.region : region,
    roleIds: Array.isArray(source.roleIds) ? source.roleIds.map(String) : [],
    adapterId: source.adapterId ? String(source.adapterId) : null,
    enabledModules: Array.isArray(source.enabledModules) ? source.enabledModules.map(String) : [],
    variableMapping: isRecord(source.variableMapping) ? source.variableMapping : {},
    calendar: isRecord(source.calendar) ? source.calendar : {},
    locations: Array.isArray(source.locations) ? source.locations : [],
    timetable: Array.isArray(source.timetable) ? source.timetable : [],
    updatedAt: new Date().toISOString(),
  };
}

export function makeOperation(input) {
  const source = isRecord(input) ? input : { command: String(input || '') };
  return {
    schema: SCHEMA_IDS.operation,
    id: String(source.id || makeId('op')),
    sourceApp: String(source.sourceApp || 'manual'),
    command: String(source.command || '').trim(),
    args: isRecord(source.args) ? source.args : {},
    targetPaths: Array.isArray(source.targetPaths) ? source.targetPaths.map(String) : [],
    note: String(source.note || ''),
    locked: Boolean(source.locked),
    reversible: source.reversible !== false,
    createdAt: source.createdAt || new Date().toISOString(),
  };
}

export function toLegacyVariables(state) {
  const roles = {};
  for (const role of Object.values(state.roles || {})) {
    if (!role?.name) continue;
    roles[role.name] = {
      好感度: role.variables?.core?.favor ?? 0,
      可疑度: role.variables?.core?.suspicion ?? 0,
      催眠状态: role.variables?.core?.hypnosis ?? { active: [], permanent: [] },
      人物档案: role.variables?.core?.profile ?? {},
      自定义: role.variables?.custom ?? {},
      _hypnoos角色ID: role.id,
      _头像资源ID: role.avatarAssetId,
    };
  }
  return {
    系统: {
      MC能量: state.resources.mcEnergy,
      _MC能量: state.resources.mcEnergy,
      MC能量上限: state.resources.mcEnergyMax,
      _MC能量上限: state.resources.mcEnergyMax,
      当前MC点: state.resources.mcPoints,
      持有零花钱: state.resources.money,
      主角可疑度: state.resources.suspicion,
      当前年份: state.time.year,
      当前日期: state.time.date,
      _当前周几: state.time.weekday,
      当前时间: state.time.clock,
      _当前日程: state.time.scheduleLabel,
      _当前特殊日期: state.time.specialDate,
      当前地点: state.location.current,
      _课程表: state.timetable,
      _hypnoos: {
        schema: state.schema,
        tasks: state.tasks,
        achievements: state.achievements,
        work: state.work,
        dispatches: state.dispatches,
        inventory: state.inventory,
        operationQueue: state.operationQueue,
      },
    },
    规则: state.custom?.rules || {},
    角色: roles,
    地点: { 当前地点: state.location.current, 新增地点: state.location.custom },
    库存: state.inventory,
    任务: state.tasks,
    成就: state.achievements,
  };
}

export function fromLegacyVariables(legacy, current, regionPack) {
  if (!isRecord(legacy)) return normalizeState(current, regionPack);
  const next = clone(current);
  const system = isRecord(legacy.系统) ? legacy.系统 : {};
  const privateStore = isRecord(system._hypnoos) ? system._hypnoos : {};
  const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  next.resources.mcEnergy = number(system.MC能量 ?? system._MC能量, next.resources.mcEnergy);
  next.resources.mcEnergyMax = number(system.MC能量上限 ?? system._MC能量上限, next.resources.mcEnergyMax);
  next.resources.mcPoints = number(system.当前MC点, next.resources.mcPoints);
  next.resources.money = number(system.持有零花钱, next.resources.money);
  next.resources.suspicion = number(system.主角可疑度, next.resources.suspicion);
  next.time = {
    ...next.time,
    year: number(system.当前年份, next.time.year),
    date: String(system.当前日期 ?? next.time.date),
    weekday: String(system._当前周几 ?? next.time.weekday),
    clock: String(system.当前时间 ?? next.time.clock),
    scheduleLabel: String(system._当前日程 ?? next.time.scheduleLabel),
    specialDate: String(system._当前特殊日期 ?? next.time.specialDate),
  };
  next.location.current = String(system.当前地点 ?? legacy.地点?.当前地点 ?? next.location.current);
  if (Array.isArray(system._课程表)) next.timetable = clone(system._课程表);
  for (const [name, value] of Object.entries(isRecord(legacy.角色) ? legacy.角色 : {})) {
    if (!isRecord(value)) continue;
    const id = String(value._hypnoos角色ID || Object.values(next.roles).find((role) => role.name === name)?.id || makeId('role'));
    const existing = next.roles[id] || createDefaultRole(name);
    next.roles[id] = {
      ...existing,
      id,
      name: sanitizeName(name),
      avatarAssetId: value._头像资源ID || existing.avatarAssetId || null,
      variables: {
        core: {
          ...existing.variables?.core,
          favor: number(value.好感度, existing.variables?.core?.favor || 0),
          suspicion: number(value.可疑度, existing.variables?.core?.suspicion || 0),
          hypnosis: isRecord(value.催眠状态) ? clone(value.催眠状态) : existing.variables?.core?.hypnosis,
          profile: isRecord(value.人物档案) ? clone(value.人物档案) : existing.variables?.core?.profile,
        },
        custom: isRecord(value.自定义) ? clone(value.自定义) : existing.variables?.custom || {},
      },
    };
  }
  for (const key of ['inventory', 'tasks', 'achievements', 'work', 'dispatches', 'operationQueue']) {
    if (Array.isArray(privateStore[key])) next[key] = clone(privateStore[key]);
  }
  if (Array.isArray(legacy.库存)) next.inventory = clone(legacy.库存);
  if (Array.isArray(legacy.任务)) next.tasks = clone(legacy.任务);
  if (Array.isArray(legacy.成就)) next.achievements = clone(legacy.成就);
  next.custom.rules = isRecord(legacy.规则) ? clone(legacy.规则) : next.custom.rules;
  return normalizeState(next, regionPack);
}
