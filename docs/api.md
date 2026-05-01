# 阿瓦隆助手 API 文档

## 约定

- Base URL: `/api`
- WebSocket URL: `/ws/rooms/{roomCode}?playerId={playerId}`
- Content-Type: `application/json`
- 鉴权：前期可以用 `X-Player-Id` 标识当前玩家；上线后建议替换为登录态 token。
- 基础包范围：5-10 人，不包含湖中仙子和兰斯洛特。
- 服务端必须负责最终随机发身份，前端只展示当前玩家可见信息。当前前端已实现本地模拟状态机，后端接入后用这些接口同步状态。
- HTTP 接口负责提交命令和查询快照；WebSocket 负责推送房间、游戏、投票进度和个人身份信息。
- 断线重连后，客户端需要先重连 WebSocket，再通过 `GET /api/rooms/{roomCode}/state` 拉取完整快照。

## 状态枚举

### RoomStatus

| 值 | 说明 |
| --- | --- |
| `lobby` | 房间等待中，可以加入、准备、调整角色配置 |
| `playing` | 对局进行中 |
| `finished` | 对局已结束 |
| `closed` | 房间已关闭或过期 |

### GamePhase

| 值 | 说明 |
| --- | --- |
| `not_started` | 未开始 |
| `role_reveal` | 身份查看阶段 |
| `speech` | 线下发言/讨论阶段，系统只记录阶段 |
| `team_building` | 队长选择出任务队伍 |
| `team_vote` | 所有玩家对队伍投票 |
| `mission_vote` | 出任务玩家提交任务票 |
| `round_result` | 本轮结果展示 |
| `assassination` | 刺客刺杀梅林阶段 |
| `finished` | 对局结束 |

### VoteStatus

| 值 | 说明 |
| --- | --- |
| `pending` | 未投 |
| `submitted` | 已投 |

## 数据结构

### Role

```json
{
  "id": "merlin",
  "name": "梅林",
  "team": "good",
  "description": "知道除莫德雷德外的坏人，终局需要避免被刺客识破。"
}
```

### RoleConfigItem

房主在开局前配置的角色池。`count` 表示该角色数量，基础角色通常为 1，忠臣/爪牙类可大于 1。

```json
{
  "roleId": "loyal",
  "count": 3
}
```

### Player

```json
{
  "id": "p_001",
  "name": "小王",
  "seat": 1,
  "isHost": true,
  "isReady": true,
  "connected": true
}
```

### Room

```json
{
  "id": "room_001",
  "code": "A1B2C3",
  "status": "lobby",
  "playerCount": 7,
  "roleConfig": [
    { "roleId": "merlin", "count": 1 },
    { "roleId": "percival", "count": 1 },
    { "roleId": "loyal", "count": 2 },
    { "roleId": "morgana", "count": 1 },
    { "roleId": "assassin", "count": 1 },
    { "roleId": "minion", "count": 1 }
  ],
  "players": [],
  "createdAt": "2026-04-26T12:00:00.000Z"
}
```

### VisibleRoleInfo

当前玩家可见的身份信息。服务端需要按玩家单独生成，不允许把完整身份列表广播给所有人。

```json
{
  "myRole": {
    "id": "merlin",
    "name": "梅林",
    "team": "good",
    "description": "知道除莫德雷德外的坏人，终局需要避免被刺客识破。"
  },
  "knownPlayers": [
    {
      "playerId": "p_005",
      "name": "小赵",
      "hint": "evil"
    }
  ],
  "notes": [
    "你知道除莫德雷德外的坏人。"
  ]
}
```

### GameState

```json
{
  "roomId": "room_001",
  "phase": "team_vote",
  "round": 1,
  "leaderPlayerId": "p_001",
  "teamPlayerIds": ["p_001", "p_003"],
  "teamVoteProgress": {
    "required": 7,
    "submitted": 3,
    "players": {
      "p_001": "submitted",
      "p_002": "pending"
    }
  },
  "missionVoteProgress": {
    "required": 2,
    "submitted": 0,
    "players": {
      "p_001": "pending",
      "p_003": "pending"
    }
  },
  "history": [],
  "winner": null,
  "updatedAt": "2026-04-26T12:05:00.000Z"
}
```

### RoundResult

```json
{
  "round": 1,
  "leaderPlayerId": "p_001",
  "teamPlayerIds": ["p_001", "p_003"],
  "teamVoteResult": {
    "approveCount": 5,
    "rejectCount": 2,
    "passed": true
  },
  "missionResult": {
    "successCount": 1,
    "failCount": 1,
    "passed": false
  }
}
```

### RoomState

用于初始化、刷新和断线重连后的完整快照。

```json
{
  "room": {},
  "game": {},
  "visibleRoleInfo": {}
}
```

## 房间接口

### 创建房间

`POST /api/rooms`

Request:

```json
{
  "playerCount": 7,
  "hostName": "小王",
  "roleConfig": [
    { "roleId": "merlin", "count": 1 },
    { "roleId": "percival", "count": 1 },
    { "roleId": "loyal", "count": 2 },
    { "roleId": "morgana", "count": 1 },
    { "roleId": "assassin", "count": 1 },
    { "roleId": "minion", "count": 1 }
  ]
}
```

Response:

```json
{
  "room": {
    "id": "room_001",
    "code": "A1B2C3",
    "status": "lobby",
    "playerCount": 7,
    "roleConfig": [
      { "roleId": "merlin", "count": 1 },
      { "roleId": "percival", "count": 1 },
      { "roleId": "loyal", "count": 2 },
      { "roleId": "morgana", "count": 1 },
      { "roleId": "assassin", "count": 1 },
      { "roleId": "minion", "count": 1 }
    ],
    "players": [
      {
        "id": "p_001",
        "name": "小王",
        "seat": 1,
        "isHost": true,
        "isReady": true,
        "connected": true
      }
    ],
    "createdAt": "2026-04-26T12:00:00.000Z"
  },
  "currentPlayerId": "p_001"
}
```

### 加入房间

`POST /api/rooms/{roomCode}/join`

Request:

```json
{
  "playerName": "小李"
}
```

Response:

```json
{
  "room": {},
  "currentPlayerId": "p_002"
}
```

### 更新房间角色配置

仅房主可操作，且只允许在 `lobby` 状态修改。服务端需要校验 `roleConfig` 的数量总和等于 `playerCount`。

`PUT /api/rooms/{roomCode}/role-config`

Request:

```json
{
  "hostPlayerId": "p_001",
  "playerCount": 7,
  "roleConfig": [
    { "roleId": "merlin", "count": 1 },
    { "roleId": "percival", "count": 1 },
    { "roleId": "loyal", "count": 2 },
    { "roleId": "morgana", "count": 1 },
    { "roleId": "assassin", "count": 1 },
    { "roleId": "minion", "count": 1 }
  ]
}
```

Response:

```json
{
  "room": {}
}
```

### 玩家准备

玩家加入房间后调用。所有非房主玩家准备后，房主才可以开始游戏；也可以要求房主显式准备。

`POST /api/rooms/{roomCode}/ready`

Request:

```json
{
  "playerId": "p_002",
  "isReady": true
}
```

Response:

```json
{
  "room": {}
}
```

### 获取房间

`GET /api/rooms/{roomCode}`

Response:

```json
{
  "room": {}
}
```

### 获取房间完整状态

用于页面首次进入和 WebSocket 断线重连后的状态恢复。

`GET /api/rooms/{roomCode}/state`

Response:

```json
{
  "room": {},
  "game": {},
  "visibleRoleInfo": {}
}
```

### 离开房间

`POST /api/rooms/{roomCode}/leave`

Request:

```json
{
  "playerId": "p_002"
}
```

Response:

```json
{
  "room": {}
}
```

## 对局接口

### 开始对局并发身份

仅房主可操作。服务端必须校验：

- 房间状态为 `lobby`。
- 玩家人数等于 `playerCount`。
- 所有需要准备的玩家均已准备。
- `roleConfig` 数量总和等于 `playerCount`。

`POST /api/rooms/{roomCode}/game/start`

Request:

```json
{
  "hostPlayerId": "p_001"
}
```

Response:

```json
{
  "game": {},
  "visibleRoleInfo": {}
}
```

### 获取对局状态

`GET /api/rooms/{roomCode}/game`

Response:

```json
{
  "game": {},
  "visibleRoleInfo": {}
}
```

### 获取当前玩家身份信息

用于玩家重新进入房间、刷新页面或身份卡单独加载。只返回当前玩家可见的信息。

`GET /api/rooms/{roomCode}/game/my-role`

Response:

```json
{
  "visibleRoleInfo": {}
}
```

### 提交出任务队伍

`POST /api/rooms/{roomCode}/game/team`

Request:

```json
{
  "leaderPlayerId": "p_001",
  "teamPlayerIds": ["p_001", "p_003", "p_005"]
}
```

Response:

```json
{
  "game": {}
}
```

### 进入发言/讨论阶段

系统不处理发言内容，只记录当前阶段。这个接口可由房主或当前队长调用，用于把对局从身份查看、回合结算等阶段推进到线下讨论阶段。

`POST /api/rooms/{roomCode}/game/speech`

Request:

```json
{
  "playerId": "p_001"
}
```

Response:

```json
{
  "game": {}
}
```

### 队伍投票

`POST /api/rooms/{roomCode}/game/team-votes`

Request:

```json
{
  "playerId": "p_002",
  "vote": "approve"
}
```

Response:

```json
{
  "game": {
    "phase": "team_vote",
    "teamVoteProgress": {
      "required": 7,
      "submitted": 4,
      "players": {
        "p_001": "submitted",
        "p_002": "submitted",
        "p_003": "pending"
      }
    }
  }
}
```

队伍投票全部提交后，服务端自动结算：

- 同意票大于反对票，进入 `mission_vote`。
- 否则进入下一位队长的 `team_building`。
- 对所有玩家展示同意/反对统计，但不需要暴露每个玩家的具体投票选择。

### 出任务投票

`POST /api/rooms/{roomCode}/game/mission-votes`

Request:

```json
{
  "playerId": "p_003",
  "vote": "success"
}
```

Response:

```json
{
  "game": {
    "phase": "mission_vote",
    "missionVoteProgress": {
      "required": 3,
      "submitted": 2,
      "players": {
        "p_001": "submitted",
        "p_003": "submitted",
        "p_005": "pending"
      }
    }
  }
}
```

出任务投票必须满足：

- 只有本轮 `teamPlayerIds` 中的玩家可以提交。
- 好人阵营只能提交 `success`。
- 坏人阵营可以提交 `success` 或 `fail`。
- 全部提交前只公开已投/未投进度。
- 结算时只公开成功票数、失败票数和任务是否成功，不公开每个玩家的具体任务票。

### 下一轮

`POST /api/rooms/{roomCode}/game/next-round`

Request:

```json
{
  "playerId": "p_001"
}
```

Response:

```json
{
  "game": {}
}
```

### 刺杀梅林

当好人完成三次任务成功后，进入 `assassination`。刺客提交目标后服务端结算最终胜负。

`POST /api/rooms/{roomCode}/game/assassinate`

Request:

```json
{
  "assassinPlayerId": "p_006",
  "targetPlayerId": "p_001"
}
```

Response:

```json
{
  "game": {
    "phase": "finished",
    "winner": "evil"
  }
}
```

### 重开对局

`POST /api/rooms/{roomCode}/game/reset`

Request:

```json
{
  "hostPlayerId": "p_001"
}
```

Response:

```json
{
  "room": {}
}
```

## WebSocket 实时同步

多人在线模式需要 WebSocket。HTTP 接口提交命令成功后，服务端需要把最新状态通过 WebSocket 推送给房间内相关玩家。

### 建立连接

`GET /ws/rooms/{roomCode}?playerId={playerId}`

连接成功后，服务端返回：

```json
{
  "type": "connection.ready",
  "payload": {
    "roomCode": "A1B2C3",
    "playerId": "p_001",
    "serverTime": "2026-04-26T12:00:00.000Z"
  }
}
```

客户端收到 `connection.ready` 后，应调用 `GET /api/rooms/{roomCode}/state` 拉取一次完整快照。

### 消息格式

```json
{
  "type": "game.updated",
  "payload": {},
  "version": 12,
  "createdAt": "2026-04-26T12:05:00.000Z"
}
```

- `type`: 事件类型。
- `payload`: 事件数据。
- `version`: 房间状态版本号，服务端每次状态变更递增。
- `createdAt`: 事件生成时间。

### 服务端推送事件

#### `room.updated`

玩家加入、离开、准备状态、连接状态、角色配置变化时推送给房间内所有玩家。

```json
{
  "type": "room.updated",
  "payload": {
    "room": {}
  },
  "version": 3,
  "createdAt": "2026-04-26T12:01:00.000Z"
}
```

#### `game.updated`

游戏阶段、队长、任务队伍、投票进度、回合结果、胜负变化时推送给房间内所有玩家。

```json
{
  "type": "game.updated",
  "payload": {
    "game": {}
  },
  "version": 8,
  "createdAt": "2026-04-26T12:06:00.000Z"
}
```

#### `game.private_role`

开始游戏后，服务端给每个玩家单独推送自己的身份和可见信息。该事件不能广播给整个房间。

```json
{
  "type": "game.private_role",
  "payload": {
    "visibleRoleInfo": {}
  },
  "version": 5,
  "createdAt": "2026-04-26T12:03:00.000Z"
}
```

#### `vote.progress`

投票进度变化时推送。只公开谁已提交，不公开具体投票内容。

```json
{
  "type": "vote.progress",
  "payload": {
    "voteType": "team",
    "required": 7,
    "submitted": 4,
    "players": {
      "p_001": "submitted",
      "p_002": "pending"
    }
  },
  "version": 9,
  "createdAt": "2026-04-26T12:07:00.000Z"
}
```

#### `round.result`

本轮队伍投票或任务投票完成并结算后推送。

```json
{
  "type": "round.result",
  "payload": {
    "roundResult": {}
  },
  "version": 10,
  "createdAt": "2026-04-26T12:08:00.000Z"
}
```

#### `error`

命令失败、权限不足、状态版本冲突等情况推送给当前玩家。

```json
{
  "type": "error",
  "payload": {
    "code": "ROOM_NOT_JOINABLE",
    "message": "当前房间已开始，无法加入。"
  },
  "createdAt": "2026-04-26T12:09:00.000Z"
}
```

### 客户端发送事件

前期建议所有业务命令仍走 HTTP，WebSocket 只做服务端推送。后续如果要降低延迟，可以把投票、准备、提交队伍也扩展成客户端 WebSocket 命令，但服务端仍需要复用同一套校验逻辑。

客户端可以发送心跳：

```json
{
  "type": "ping",
  "payload": {
    "clientTime": "2026-04-26T12:10:00.000Z"
  }
}
```

服务端返回：

```json
{
  "type": "pong",
  "payload": {
    "serverTime": "2026-04-26T12:10:00.000Z"
  }
}
```

### 重连策略

- 客户端断开后自动重连，建议退避间隔为 1s、2s、5s、10s。
- 重连成功后调用 `GET /api/rooms/{roomCode}/state` 获取完整快照。
- 如果本地 `version` 小于服务端快照 `version`，以服务端快照为准。
- 玩家短暂断线不应自动离开房间，只更新 `connected: false`。

## 状态保存要求

服务端需要持久化或可靠缓存以下信息，保证刷新页面、断线重连和服务重启后可恢复：

- 房间信息：`roomId`、`code`、`status`、`playerCount`、`roleConfig`、`createdAt`。
- 玩家信息：`playerId`、昵称、座位、房主标记、准备状态、连接状态。
- 身份分配：每个玩家的真实角色，仅服务端和当前玩家可见。
- 当前对局：阶段、轮次、队长、当前队伍、投票进度、胜负。
- 投票明细：服务端内部保存，用于结算；对客户端只返回进度和统计。
- 历史记录：每轮队伍、队伍投票统计、任务投票统计、任务成功/失败。

## 隐私和权限规则

- 只有房主可以修改角色配置、开始游戏、重开对局。
- 只有当前队长可以提交出任务队伍。
- 每个玩家每轮队伍投票只能提交一次，可以按产品需求决定是否允许在结算前改票。
- 只有出任务队伍内玩家可以提交任务票。
- 好人阵营不能提交失败票。
- 任务票明细不能广播，最终只展示成功票数和失败票数。
- 完整身份分配不能通过 `room.updated` 或 `game.updated` 广播。

## 常见错误码

| 错误码 | 说明 |
| --- | --- |
| `ROOM_NOT_FOUND` | 房间不存在 |
| `ROOM_NOT_JOINABLE` | 房间已开始或已关闭，无法加入 |
| `ROOM_FULL` | 房间人数已满 |
| `PLAYER_NOT_FOUND` | 玩家不存在或不在房间内 |
| `ONLY_HOST_ALLOWED` | 只有房主可以操作 |
| `ONLY_LEADER_ALLOWED` | 只有当前队长可以操作 |
| `INVALID_ROLE_CONFIG` | 角色配置无效 |
| `PLAYERS_NOT_READY` | 玩家未全部准备 |
| `GAME_ALREADY_STARTED` | 对局已经开始 |
| `INVALID_GAME_PHASE` | 当前阶段不允许该操作 |
| `INVALID_TEAM_SIZE` | 出任务人数不符合当前轮次要求 |
| `DUPLICATE_VOTE` | 当前轮次已经投过票 |
| `MISSION_VOTER_NOT_IN_TEAM` | 非出任务玩家不能提交任务票 |
| `GOOD_PLAYER_CANNOT_FAIL` | 好人阵营不能提交失败票 |
