import { Button, Input, Text, View } from '@tarojs/components'
import Taro, { useLoad, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLobbySocket, useRoomSocket } from '@/api/roomSocket'
import { getRoomState, listRooms, type RoomsResponse } from '@/api/rooms'
import {
  useCloseRoomMutation,
  useCreateRoomMutation,
  useEnterSpeechMutation,
  useAssassinateMutation,
  useJoinRoomMutation,
  useLeaveRoomMutation,
  useNextRoundMutation,
  useReadyMutation,
  useResetGameMutation,
  useStartGameMutation,
  useSubmitMissionVoteMutation,
  useSubmitTeamMutation,
  useSubmitTeamVoteMutation
} from '@/api/rooms.queries'
import { getDefaultRoleConfig, getMission, getRolePreview, MISSION_TABLE, PLAYER_COUNTS } from '@/domain/avalon'
import { useAvalonStore } from '@/store/avalonStore'
import { clearPlayerSession, getLobbyPlayerId, getPlayerSession, savePlayerSession } from '@/store/playerSession'
import './index.scss'

const getPhaseText = (phase: string) => {
  const phaseTextMap: Record<string, string> = {
    lobby: '等待玩家',
    role_reveal: '身份查看',
    speech: '发言讨论',
    team_building: '组队阶段',
    team_vote: '队伍投票',
    mission_vote: '出任务',
    round_result: '回合结算',
    assassination: '刺杀梅林',
    finished: '对局结束'
  }

  return phaseTextMap[phase] || phase
}

const getRoundStatusText = (status: string) => {
  const statusTextMap: Record<string, string> = {
    team_rejected: '队伍未通过',
    mission_pending: '任务待结算',
    mission_succeeded: '成功',
    mission_failed: '失败'
  }

  return statusTextMap[status] || status
}

const getRoundStatusClassName = (status: string) => {
  if (status === 'mission_succeeded') {
    return 'mission-fail good'
  }

  if (status === 'mission_failed') {
    return 'mission-fail'
  }

  return 'mission-fail neutral'
}

const appVersion = process.env.TARO_APP_VERSION || '0.0.0'
const cachedWechatNicknameKey = 'avalon:wechat-nickname'
const canUseWechatProfile = process.env.TARO_ENV === 'weapp'

const createDefaultPlayerName = (existingNames: string[]) => {
  const existingNameSet = new Set(existingNames)

  for (let index = 0; index < 100; index += 1) {
    const name = `玩家${Math.floor(1000 + Math.random() * 9000)}`

    if (!existingNameSet.has(name)) {
      return name
    }
  }

  return `玩家${Date.now()}`
}

export default function Index () {
  const roomCode = useAvalonStore((state) => state.roomCode)
  const joinCode = useAvalonStore((state) => state.joinCode)
  const playerName = useAvalonStore((state) => state.playerName)
  const playerCount = useAvalonStore((state) => state.playerCount)
  const players = useAvalonStore((state) => state.players)
  const currentPlayerId = useAvalonStore((state) => state.currentPlayerId)
  const visibleRoleInfo = useAvalonStore((state) => state.visibleRoleInfo)
  const activePlayerId = useAvalonStore((state) => state.activePlayerId)
  const phase = useAvalonStore((state) => state.phase)
  const roundIndex = useAvalonStore((state) => state.roundIndex)
  const leaderIndex = useAvalonStore((state) => state.leaderIndex)
  const selectedTeamIds = useAvalonStore((state) => state.selectedTeamIds)
  const teamVotes = useAvalonStore((state) => state.teamVotes)
  const missionVotes = useAvalonStore((state) => state.missionVotes)
  const history = useAvalonStore((state) => state.history)
  const winner = useAvalonStore((state) => state.winner)
  const setJoinCode = useAvalonStore((state) => state.setJoinCode)
  const setPlayerName = useAvalonStore((state) => state.setPlayerName)
  const setPlayerCount = useAvalonStore((state) => state.setPlayerCount)
  const setCurrentPlayerId = useAvalonStore((state) => state.setCurrentPlayerId)
  const localJoinRoom = useAvalonStore((state) => state.joinRoom)
  const localRemovePlayer = useAvalonStore((state) => state.removePlayer)
  const setActivePlayer = useAvalonStore((state) => state.setActivePlayer)
  const localStartGame = useAvalonStore((state) => state.startGame)
  const toggleTeamMember = useAvalonStore((state) => state.toggleTeamMember)
  const localSubmitTeam = useAvalonStore((state) => state.submitTeam)
  const localCastTeamVote = useAvalonStore((state) => state.castTeamVote)
  const localCastMissionVote = useAvalonStore((state) => state.castMissionVote)
  const localNextRound = useAvalonStore((state) => state.nextRound)
  const syncRemoteRoom = useAvalonStore((state) => state.syncRemoteRoom)
  const syncRemoteGame = useAvalonStore((state) => state.syncRemoteGame)
  const setVisibleRoleInfo = useAvalonStore((state) => state.setVisibleRoleInfo)
  const reset = useAvalonStore((state) => state.reset)

  const rolePreview = useMemo(() => getRolePreview(playerCount), [playerCount])
  const evilCount = useMemo(() => rolePreview.filter((role) => role.team === 'evil').length, [rolePreview])
  const activePlayer = players.find((player) => player.id === activePlayerId)
  const currentPlayer = players.find((player) => player.id === currentPlayerId)
  const isCurrentPlayerHost = Boolean(currentPlayer?.isHost)
  const leader = players[leaderIndex]
  const isCurrentPlayerLeader = leader?.id === currentPlayerId
  const currentMission = getMission(playerCount, roundIndex)
  const successRounds = history.filter((result) => result.status === 'mission_succeeded').length
  const failedRounds = history.filter((result) => result.status === 'mission_failed').length
  const canEditLobby = phase === 'lobby' || phase === 'not_started'
  const hasGameStarted = phase !== 'lobby' && phase !== 'not_started'
  const readyPlayerCount = players.filter((player) => player.isReady).length
  const isRoomFull = players.length === playerCount
  const isEveryoneReady = isRoomFull && players.every((player) => player.isHost || player.isReady)
  const hasJoinedRoom = Boolean(roomCode && currentPlayer)
  const canCreateRoom = !hasJoinedRoom
  const canJoinRoom = canEditLobby && !hasJoinedRoom
  const canBuildTeam = (phase === 'team_building' || phase === 'speech') && isCurrentPlayerLeader
  const hasCurrentPlayerTeamVoted = Boolean(currentPlayerId && teamVotes[currentPlayerId])
  const canVoteForTeam = phase === 'team_vote' && Boolean(currentPlayerId) && !hasCurrentPlayerTeamVoted
  const isCurrentPlayerOnMission = selectedTeamIds.includes(currentPlayerId)
  const hasCurrentPlayerMissionVoted = Boolean(currentPlayerId && missionVotes[currentPlayerId])
  const canVoteForMission = phase === 'mission_vote' && isCurrentPlayerOnMission && !hasCurrentPlayerMissionVoted
  const canStartGame = canEditLobby && isCurrentPlayerHost && isEveryoneReady
  const latestResult = history[history.length - 1]
  const activeRole = activePlayer?.role || (activePlayer?.id === currentPlayerId ? visibleRoleInfo?.myRole : undefined)
  const currentRole = currentPlayer?.role || visibleRoleInfo?.myRole
  const canAssassinate = phase === 'assassination' && currentRole?.id === 'assassin'
  const resolvedWinner = winner || (failedRounds >= 3 ? 'evil' : null)
  const isAssassinationFinished = phase === 'finished' && successRounds >= 3
  const finalResultClassName = resolvedWinner === 'good' ? 'result-text good' : 'result-text evil'
  const finalResultText = resolvedWinner === 'good'
    ? '好人阵营获胜。'
    : resolvedWinner === 'evil'
      ? '坏人阵营获胜。'
      : '对局结束，等待最终胜负同步。'
  const assassinationResultText = isAssassinationFinished && resolvedWinner
    ? resolvedWinner === 'evil'
      ? '刺杀正确，刺客命中梅林。'
      : '刺杀失败，梅林存活。'
    : ''
  const [roomsData, setRoomsData] = useState<RoomsResponse | null>(null)
  const [roomsIsLoading, setRoomsIsLoading] = useState(false)
  const [roomsIsFetching, setRoomsIsFetching] = useState(false)
  const [roomsError, setRoomsError] = useState<unknown>(null)
  const createRoomMutation = useCreateRoomMutation()
  const joinRoomMutation = useJoinRoomMutation()
  const refetchRoomsRef = useRef<() => Promise<void>>(async () => undefined)
  const lobbyRoomsRefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lobbyPlayerId = useMemo(() => getLobbyPlayerId(), [])
  const closeRoomMutation = useCloseRoomMutation(roomCode)
  const leaveRoomMutation = useLeaveRoomMutation(roomCode)
  const readyMutation = useReadyMutation(roomCode)
  const startGameMutation = useStartGameMutation(roomCode)
  const enterSpeechMutation = useEnterSpeechMutation(roomCode)
  const submitTeamMutation = useSubmitTeamMutation(roomCode)
  const submitTeamVoteMutation = useSubmitTeamVoteMutation(roomCode)
  const submitMissionVoteMutation = useSubmitMissionVoteMutation(roomCode)
  const nextRoundMutation = useNextRoundMutation(roomCode)
  const assassinateMutation = useAssassinateMutation(roomCode)
  const resetGameMutation = useResetGameMutation(roomCode)
  const joinableRooms = useMemo(() => {
    const rooms = Array.isArray(roomsData?.rooms) ? roomsData.rooms : []

    return rooms.filter((room) => {
      const roomPlayers = Array.isArray(room.players) ? room.players : []

      return room.status === 'lobby' && roomPlayers.length < room.playerCount
    })
  }, [roomsData?.rooms])
  const typedRoomsError = roomsError as { data?: { message?: string }, message?: string } | null
  const roomsErrorText = typedRoomsError?.data?.message || typedRoomsError?.message || '大厅列表加载失败'
  const shareTitle = roomCode ? `加入阿瓦隆房间 ${roomCode}` : '阿瓦隆小助手'
  const sharePath = roomCode ? `/pages/index/index?roomCode=${encodeURIComponent(roomCode)}` : '/pages/index/index'

  useLoad((options) => {
    const sharedRoomCode = typeof options.roomCode === 'string' ? options.roomCode.trim().toUpperCase() : ''

    if (sharedRoomCode && !roomCode) {
      setJoinCode(sharedRoomCode)
    }
  })

  useShareAppMessage(() => ({
    title: shareTitle,
    path: sharePath
  }))

  useShareTimeline(() => ({
    title: shareTitle,
    query: roomCode ? `roomCode=${encodeURIComponent(roomCode)}` : ''
  }))

  const getPlayerName = useCallback((playerId: string) => {
    return players.find((player) => player.id === playerId)?.name || playerId
  }, [players])

  const hasHydratedCachedNicknameRef = useRef(false)

  const showToast = useCallback((message?: string) => {
    if (message) {
      Taro.showToast({ title: message, icon: 'none' })
    }
  }, [])

  const handlePlayerNameInput = useCallback((value: string) => {
    setPlayerName(value)

    if (canUseWechatProfile && value.trim()) {
      Taro.setStorageSync(cachedWechatNicknameKey, value.trim())
    }
  }, [setPlayerName])

  const refetchRooms = useCallback(async () => {
    if (hasJoinedRoom) {
      return
    }

    setRoomsIsFetching(true)
    setRoomsError(null)

    try {
      const data = await listRooms()
      setRoomsData(data)
    } catch (error) {
      setRoomsError(error)
    } finally {
      setRoomsIsFetching(false)
      setRoomsIsLoading(false)
    }
  }, [hasJoinedRoom])

  useEffect(() => {
    refetchRoomsRef.current = refetchRooms
  }, [refetchRooms])

  useEffect(() => {
    if (hasJoinedRoom) {
      setRoomsIsLoading(false)
      setRoomsIsFetching(false)
      return
    }

    setRoomsIsLoading(true)
    refetchRooms()
  }, [hasJoinedRoom, refetchRooms])

  useEffect(() => {
    return () => {
      if (lobbyRoomsRefetchTimerRef.current) {
        clearTimeout(lobbyRoomsRefetchTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!canUseWechatProfile || hasHydratedCachedNicknameRef.current) {
      return
    }

    hasHydratedCachedNicknameRef.current = true

    if (playerName.trim()) {
      return
    }

    const cachedNickname = Taro.getStorageSync<string>(cachedWechatNicknameKey)

    if (cachedNickname) {
      setPlayerName(cachedNickname)
    }
  }, [playerName, setPlayerName])

  const getButtonClassName = (className: string, disabled: boolean) => {
    return disabled ? `${className} button-disabled` : className
  }

  const handleSocketGameUpdated = useCallback((game) => {
    syncRemoteGame(game)
  }, [syncRemoteGame])

  const handleSocketRoomUpdated = useCallback((room) => {
    const roomPlayers = Array.isArray(room.players) ? room.players : []
    const isStillInRoom = roomPlayers.some((player) => player.id === currentPlayerId)

    if (room.status === 'closed' || (currentPlayerId && !isStillInRoom)) {
      clearPlayerSession()
      reset()
      showToast(room.status === 'closed' ? '房间已解散' : '你已离开房间')
      return
    }

    syncRemoteRoom(room)
  }, [currentPlayerId, reset, showToast, syncRemoteRoom])

  const handleSocketStateLoaded = useCallback((state) => {
    const roomPlayers = Array.isArray(state.room.players) ? state.room.players : []
    const isStillInRoom = roomPlayers.some((player) => player.id === currentPlayerId)

    if (state.room.status === 'closed' || (currentPlayerId && !isStillInRoom)) {
      clearPlayerSession()
      reset()
      showToast(state.room.status === 'closed' ? '房间已解散' : '你已离开房间')
      return
    }

    syncRemoteRoom(state.room)

    if (state.game) {
      syncRemoteGame(state.game, state.visibleRoleInfo)
    } else {
      setVisibleRoleInfo(state.visibleRoleInfo)
    }
  }, [currentPlayerId, reset, setVisibleRoleInfo, showToast, syncRemoteGame, syncRemoteRoom])

  const handleRoomClosed = useCallback(() => {
    clearPlayerSession()
    reset()
    showToast('房间已解散')
  }, [reset, showToast])

  const handleLobbyRoomsChanged = useCallback(() => {
    if (lobbyRoomsRefetchTimerRef.current) {
      clearTimeout(lobbyRoomsRefetchTimerRef.current)
    }

    lobbyRoomsRefetchTimerRef.current = setTimeout(() => {
      refetchRoomsRef.current()
      lobbyRoomsRefetchTimerRef.current = null
    }, 300)
  }, [])

  const handleManualRefreshRooms = useCallback(() => {
    refetchRooms()
  }, [refetchRooms])

  useEffect(() => {
    const session = getPlayerSession()

    if (!session || roomCode || currentPlayerId) {
      return
    }

    getRoomState(session.roomCode, session.playerId).then((state) => {
      const roomPlayers = Array.isArray(state.room.players) ? state.room.players : []
      const isStillInRoom = roomPlayers.some((player) => player.id === session.playerId)

      if (state.room.status === 'closed' || !isStillInRoom) {
        clearPlayerSession()
        return
      }

      syncRemoteRoom(state.room, session.playerId)
      setCurrentPlayerId(session.playerId)

      if (state.game) {
        syncRemoteGame(state.game, state.visibleRoleInfo)
      } else {
        setVisibleRoleInfo(state.visibleRoleInfo)
      }
    }).catch(() => {
      clearPlayerSession()
    })
  }, [currentPlayerId, roomCode, setCurrentPlayerId, setVisibleRoleInfo, syncRemoteGame, syncRemoteRoom])

  useRoomSocket({
    roomCode,
    playerId: currentPlayerId,
    enabled: Boolean(roomCode && currentPlayerId),
    onRoomUpdated: handleSocketRoomUpdated,
    onGameUpdated: handleSocketGameUpdated,
    onPrivateRole: setVisibleRoleInfo,
    onRoomClosed: handleRoomClosed,
    onStateLoaded: handleSocketStateLoaded,
    onError: showToast
  })

  useLobbySocket({
    playerId: lobbyPlayerId,
    enabled: !hasJoinedRoom,
    onRoomsChanged: handleLobbyRoomsChanged,
    onError: showToast
  })

  const showError = (error: unknown) => {
    const fallback = error instanceof Error ? error.message : '请求失败'
    const apiError = error as { data?: { message?: string } }
    showToast(apiError.data?.message || fallback)
  }

  const getPlayerNameOrCachedNickname = () => {
    const trimmedName = playerName.trim()

    if (trimmedName) {
      return trimmedName
    }

    if (!canUseWechatProfile) {
      return ''
    }

    const cachedNickname = Taro.getStorageSync<string>(cachedWechatNicknameKey)

    if (cachedNickname) {
      setPlayerName(cachedNickname)
      return cachedNickname
    }

    return ''
  }

  const handleCreateRoom = async () => {
    if (hasJoinedRoom) {
      showToast('已在房间中，不能创建其他房间')
      return
    }

    const hostName = getPlayerNameOrCachedNickname()

    if (canUseWechatProfile && !hostName) {
      showToast('请先填写或选择微信昵称')
      return
    }

    try {
      const data = await createRoomMutation.mutateAsync({
        playerCount,
        hostName: hostName || '房主',
        roleConfig: getDefaultRoleConfig(playerCount)
      })
      syncRemoteRoom(data.room, data.currentPlayerId)
      savePlayerSession({
        roomCode: data.room.code,
        playerId: data.currentPlayerId
      })
      setPlayerName('')
      showToast('房间已创建')
    } catch (error) {
      showError(error)
    }
  }

  const handleJoinRoom = async (targetRoomCode?: string) => {
    if (hasJoinedRoom) {
      showToast('已在房间中，不能加入其他房间')
      return
    }

    const code = targetRoomCode || roomCode || joinCode.trim().toUpperCase()
    const name = getPlayerNameOrCachedNickname()

    if (!code) {
      showToast(localJoinRoom().message)
      return
    }

    if (canUseWechatProfile && !name) {
      showToast('请先填写或选择微信昵称')
      return
    }

    try {
      const data = await joinRoomMutation.mutateAsync({
        roomCode: code,
        payload: {
          playerName: name || createDefaultPlayerName(players.map((player) => player.name))
        }
      })
      syncRemoteRoom(data.room, currentPlayerId && roomCode ? undefined : data.currentPlayerId)
      savePlayerSession({
        roomCode: data.room.code,
        playerId: currentPlayerId && roomCode ? currentPlayerId : data.currentPlayerId
      })
      setPlayerName('')
      showToast('已加入房间')
    } catch (error) {
      showError(error)
    }
  }

  const handleStartGame = async () => {
    if (!currentPlayerId) {
      showToast(localStartGame().message || '缺少当前玩家，请先创建或加入房间')
      return
    }

    try {
      const data = await startGameMutation.mutateAsync({
        hostPlayerId: currentPlayerId
      })
      syncRemoteGame(data.game, data.visibleRoleInfo)
      showToast('对局已开始')
    } catch (error) {
      showError(error)
    }
  }

  const handleReady = async (playerId: string, isReady: boolean) => {
    if (playerId !== currentPlayerId) {
      showToast('只能准备自己')
      return
    }

    try {
      const data = await readyMutation.mutateAsync({
        playerId,
        isReady
      })
      syncRemoteRoom(data.room)
    } catch (error) {
      showError(error)
    }
  }

  const handleLeaveRoom = async (playerId: string) => {
    const isSelf = playerId === currentPlayerId
    const canKick = isCurrentPlayerHost && !isSelf

    if (!isSelf && !canKick) {
      showToast('只有房主可以移除其他玩家')
      return
    }

    if (isSelf && hasGameStarted) {
      const result = await Taro.showModal({
        title: '确认退出',
        content: '对局已经开始，退出后将离开当前房间。确定要退出吗？',
        confirmText: '退出',
        cancelText: '取消'
      })

      if (!result.confirm) {
        return
      }
    }

    try {
      const data = await leaveRoomMutation.mutateAsync({
        playerId
      })

      if (isSelf) {
        clearPlayerSession()
        reset()
        return
      }

      syncRemoteRoom(data.room)
    } catch (error) {
      if (canKick) {
        localRemovePlayer(playerId)
      }

      showError(error)
    }
  }

  const handleDissolveRoom = async () => {
    if (!currentPlayerId) {
      showToast('缺少当前玩家')
      return
    }

    const result = await Taro.showModal({
      title: '确认解散',
      content: '解散后所有玩家都会离开当前房间。确定要解散吗？',
      confirmText: '解散',
      cancelText: '取消'
    })

    if (!result.confirm) {
      return
    }

    try {
      await closeRoomMutation.mutateAsync({
        hostPlayerId: currentPlayerId
      })
      handleRoomClosed()
    } catch (error) {
      showError(error)
    }
  }

  const handleEnterSpeech = async () => {
    if (!currentPlayerId) {
      showToast('缺少当前玩家')
      return
    }

    try {
      const data = await enterSpeechMutation.mutateAsync({
        playerId: currentPlayerId
      })
      syncRemoteGame(data.game, data.visibleRoleInfo)
    } catch (error) {
      showError(error)
    }
  }

  const handleSubmitTeam = async () => {
    if (!isCurrentPlayerLeader) {
      showToast('只有当前队长可以提交队伍')
      return
    }

    if (selectedTeamIds.length !== currentMission.teamSize) {
      showToast(`本轮需要选择 ${currentMission.teamSize} 名玩家`)
      return
    }

    try {
      const data = await submitTeamMutation.mutateAsync({
        leaderPlayerId: currentPlayerId,
        teamPlayerIds: selectedTeamIds
      })
      syncRemoteGame(data.game, data.visibleRoleInfo)
    } catch (error) {
      showToast(localSubmitTeam().message)
      showError(error)
    }
  }

  const handleTeamVote = async (playerId: string, vote: 'approve' | 'reject') => {
    if (playerId !== currentPlayerId) {
      showToast('只能提交自己的队伍投票')
      return
    }

    try {
      const data = await submitTeamVoteMutation.mutateAsync({
        playerId,
        vote
      })
      syncRemoteGame(data.game, data.visibleRoleInfo)
    } catch (error) {
      localCastTeamVote(playerId, vote)
      showError(error)
    }
  }

  const handleMissionVote = async (playerId: string, vote: 'success' | 'fail') => {
    if (playerId !== currentPlayerId) {
      showToast('只能提交自己的任务投票')
      return
    }

    try {
      const data = await submitMissionVoteMutation.mutateAsync({
        playerId,
        vote
      })
      syncRemoteGame(data.game, data.visibleRoleInfo)
    } catch (error) {
      showToast(localCastMissionVote(playerId, vote).message)
      showError(error)
    }
  }

  const handleNextRound = async () => {
    if (!currentPlayerId) {
      localNextRound()
      return
    }

    try {
      const data = await nextRoundMutation.mutateAsync({
        playerId: currentPlayerId
      })
      syncRemoteGame(data.game, data.visibleRoleInfo)
    } catch (error) {
      showError(error)
    }
  }

  const handleAssassinate = async (targetPlayerId: string) => {
    if (!currentPlayerId) {
      showToast('缺少当前玩家')
      return
    }

    if (!canAssassinate) {
      showToast('只有刺客可以刺杀梅林')
      return
    }

    try {
      const data = await assassinateMutation.mutateAsync({
        assassinPlayerId: currentPlayerId,
        targetPlayerId
      })
      syncRemoteGame(data.game, data.visibleRoleInfo)
    } catch (error) {
      showError(error)
    }
  }

  const handleRestartGame = async () => {
    if (!currentPlayerId) {
      showToast('缺少当前玩家')
      return
    }

    if (!isCurrentPlayerHost) {
      showToast('只有房主可以重开对局')
      return
    }

    try {
      const data = await resetGameMutation.mutateAsync({
        hostPlayerId: currentPlayerId
      })
      syncRemoteRoom(data.room)
    } catch (error) {
      showError(error)
    }
  }

  return (
    <View className='avalon-page'>
      <View className='hero'>
        <Text className='eyebrow'>Avalon Dealer</Text>
        <Text className='title'>阿瓦隆小助手</Text>
        <Text className='subtitle'>基础包发牌、回合记录、队伍投票与出任务投票。</Text>
      </View>

      <View className='panel room-panel'>
        <View className='panel-head'>
          <View>
            <Text className='panel-title'>房间</Text>
            <Text className='panel-desc'>当前状态：{getPhaseText(phase)}{currentPlayer?.name ? `，你是 ${currentPlayer.name}` : ''}</Text>
          </View>
          <Text className='room-code'>{roomCode || '未创建'}</Text>
        </View>

        {!hasJoinedRoom ? (
          <View className='toolbar'>
            {PLAYER_COUNTS.map((count) => (
              (() => {
                const isDisabled = !canEditLobby || players.length > 0
                const className = count === playerCount ? 'count-button active' : 'count-button'

                return (
                  <Button
                    key={count}
                    className={getButtonClassName(className, isDisabled)}
                    disabled={isDisabled}
                    onClick={() => setPlayerCount(count)}
                  >
                    <Text className='count-button-text'>{count}人</Text>
                  </Button>
                )
              })()
            ))}
          </View>
        ) : null}

        {!hasJoinedRoom ? (
          <View className='action-grid'>
            <Button className={getButtonClassName('primary-button', !canCreateRoom)} disabled={!canCreateRoom} loading={createRoomMutation.isPending} onClick={handleCreateRoom}>
              创建房间
            </Button>
          </View>
        ) : null}

        {!hasJoinedRoom ? (
          <View className='join-box'>
            <Input
              className='field'
              disabled={!canJoinRoom}
              maxlength={8}
              placeholder='房间号'
              value={joinCode}
              onInput={(event) => setJoinCode(String(event.detail.value).toUpperCase())}
            />
            <Input
              className='field'
              disabled={!canJoinRoom}
              maxlength={12}
              type={canUseWechatProfile ? 'nickname' : 'text'}
              placeholder='玩家昵称'
              value={playerName}
              onInput={(event) => handlePlayerNameInput(String(event.detail.value))}
            />
            <Button className={getButtonClassName('secondary-button', !canJoinRoom)} disabled={!canJoinRoom} loading={joinRoomMutation.isPending} onClick={() => handleJoinRoom()}>
              加入房间
            </Button>
          </View>
        ) : null}
      </View>

      {!hasJoinedRoom ? (
        <View className='panel'>
        <View className='panel-head'>
          <View>
            <Text className='panel-title'>当前大厅</Text>
            <Text className='panel-desc'>只展示等待中且未满员的房间。</Text>
          </View>
          <Button className='text-button' loading={roomsIsFetching} onClick={handleManualRefreshRooms}>
            刷新
          </Button>
        </View>

        <View className='lobby-list'>
          {roomsIsLoading ? (
            <Text className='empty-text'>大厅同步中</Text>
          ) : null}

          {roomsError ? (
            <Text className='empty-text'>{roomsErrorText}</Text>
          ) : null}

          {!roomsIsLoading && !roomsError && joinableRooms.length === 0 ? (
            <Text className='empty-text'>暂无可加入房间</Text>
          ) : null}

          {joinableRooms.map((room) => (
            (() => {
              const roomPlayers = Array.isArray(room.players) ? room.players : []
              const isAlreadyInRoom = roomPlayers.some((player) => player.id === currentPlayerId)

              return (
                <View key={room.id} className='lobby-row'>
                  <View className='lobby-main'>
                    <Text className='lobby-code'>{room.code}</Text>
                    <Text className='lobby-meta'>{roomPlayers.length}/{room.playerCount} 人</Text>
                  </View>
                  <View className='lobby-action'>
                    {isAlreadyInRoom ? (
                      <Text className='lobby-status'>已在房间</Text>
                    ) : hasJoinedRoom ? (
                      <Text className='lobby-status muted'>已在其他房间</Text>
                    ) : (
                      <Button
                        className='text-button lobby-button'
                        loading={joinRoomMutation.isPending}
                        onClick={() => handleJoinRoom(room.code)}
                      >
                        加入
                      </Button>
                    )}
                  </View>
                </View>
              )
            })()
          ))}
        </View>
        </View>
      ) : null}

      {hasJoinedRoom ? (
        <View className='panel'>
          <View className='panel-head'>
            <View>
              <Text className='panel-title'>对局</Text>
              <Text className='panel-desc'>{roomCode}，{players.length}/{playerCount} 已加入，{readyPlayerCount}/{players.length || playerCount} 已准备</Text>
            </View>
          </View>

          <View className='match-actions'>
            {currentPlayer && !currentPlayer.isHost ? (
              <Button className='match-button' loading={leaveRoomMutation.isPending} onClick={() => handleLeaveRoom(currentPlayer.id)}>
                退出
              </Button>
            ) : null}
            {currentPlayer?.isHost ? (
              <Button className='match-button' loading={closeRoomMutation.isPending} onClick={handleDissolveRoom}>
                解散
              </Button>
            ) : null}
            {isCurrentPlayerHost && !hasGameStarted ? (
              <Button className={getButtonClassName('match-button primary', !canStartGame)} disabled={!canStartGame} loading={startGameMutation.isPending} onClick={handleStartGame}>
                开始
              </Button>
            ) : null}
            {hasGameStarted && currentPlayer ? (
              <Button className='match-button' onClick={() => setActivePlayer(activePlayerId === currentPlayer.id ? '' : currentPlayer.id)}>
                {activePlayerId === currentPlayer.id ? '隐藏身份' : '查看身份'}
              </Button>
            ) : null}
            {canUseWechatProfile ? (
              <Button className='match-button' openType='share'>
                转发
              </Button>
            ) : null}
          </View>

          {hasGameStarted && activePlayer && activeRole ? (
            <View className={activeRole.team === 'good' ? 'role-card in-match good' : 'role-card in-match evil'}>
              <Text className='role-owner'>{activePlayer.name} 的身份</Text>
              <Text className='role-name'>{activeRole.name}</Text>
              <Text className='role-team'>{activeRole.team === 'good' ? '好人阵营' : '坏人阵营'}</Text>
              <Text className='role-desc'>{activeRole.description}</Text>
            </View>
          ) : null}

          <View className='player-list'>
            {players.length === 0 ? (
              <Text className='empty-text'>等待玩家加入</Text>
            ) : null}

            {players.map((player, index) => {
              const isLeader = leader?.id === player.id && hasGameStarted
              const isSelected = selectedTeamIds.includes(player.id)

              return (
                <View key={player.id} className={isSelected ? 'player-row selected' : 'player-row'}>
                  <View className='player-main'>
                    <Text className='seat'>#{index + 1}</Text>
                    <Text className='player-name'>{player.name}</Text>
                    {isLeader ? <Text className='tag'>队长</Text> : null}
                    {player.isHost ? <Text className='tag'>房主</Text> : null}
                    {canEditLobby && player.isReady ? <Text className='tag ready'>已准备</Text> : null}
                  </View>
                  <View className='player-actions'>
                    {canEditLobby && isCurrentPlayerHost && player.id !== currentPlayerId ? (
                      <Button className='text-button' loading={leaveRoomMutation.isPending} onClick={() => handleLeaveRoom(player.id)}>
                        移除
                      </Button>
                    ) : null}
                    {canEditLobby && player.id === currentPlayerId && !player.isHost ? (
                      <Button className='text-button' loading={readyMutation.isPending} onClick={() => handleReady(player.id, !player.isReady)}>
                        {player.isReady ? '取消' : '准备'}
                      </Button>
                    ) : null}
                    {canBuildTeam ? (
                      <Button className='text-button' onClick={() => toggleTeamMember(player.id)}>
                        {isSelected ? '取消' : '选中'}
                      </Button>
                    ) : null}
                  </View>
                </View>
              )
            })}
          </View>
        </View>
      ) : null}

      {hasGameStarted ? (
        <View className='panel'>
          <View className='panel-head'>
            <View>
              <Text className='panel-title'>第{currentMission.round}轮</Text>
              <Text className='panel-desc'>
                队长 {leader?.name || '-'}，需要 {currentMission.teamSize} 人出任务，{currentMission.failsRequired} 败失败
              </Text>
            </View>
            <View className='score-box'>
              <Text className='score good'>{successRounds}</Text>
              <Text className='score evil'>{failedRounds}</Text>
            </View>
          </View>

          {(phase === 'role_reveal' || phase === 'speech') ? (
            <View className='phase-box'>
              <Text className='phase-text'>
                {phase === 'role_reveal' ? '请各自查看身份，确认后进入发言讨论。' : '线下讨论完成后，由队长选择出任务队伍。'}
              </Text>
              {phase === 'role_reveal' ? (
                <Button className='primary-button' loading={enterSpeechMutation.isPending} onClick={handleEnterSpeech}>
                  进入发言
                </Button>
              ) : null}
            </View>
          ) : null}

          {(phase === 'team_building' || phase === 'speech') ? (
            <View className='phase-box'>
              <Text className='phase-text'>已选择 {selectedTeamIds.length}/{currentMission.teamSize}</Text>
              {isCurrentPlayerLeader ? (
                <Button className='primary-button' loading={submitTeamMutation.isPending} onClick={handleSubmitTeam}>
                  提交队伍
                </Button>
              ) : (
                <Text className='phase-text'>等待队长提交队伍</Text>
              )}
            </View>
          ) : null}

          {phase === 'team_vote' ? (
            <View className='phase-box'>
              <Text className='phase-text'>本次出任务队伍</Text>
              <View className='team-chip-list'>
                {players.filter((player) => selectedTeamIds.includes(player.id)).map((player) => (
                  <Text key={player.id} className='team-chip'>{player.name}</Text>
                ))}
              </View>
              {canVoteForTeam ? (
                <View className='round-vote-actions'>
                  <Button className='large-vote-button approve' loading={submitTeamVoteMutation.isPending} onClick={() => handleTeamVote(currentPlayerId, 'approve')}>
                    同意
                  </Button>
                  <Button className='large-vote-button reject' loading={submitTeamVoteMutation.isPending} onClick={() => handleTeamVote(currentPlayerId, 'reject')}>
                    反对
                  </Button>
                </View>
              ) : null}
              <View className='vote-list'>
                {players.map((player) => (
                  <View key={player.id} className='vote-row'>
                    <Text className='player-name'>{player.name}</Text>
                    <Text className='vote-state'>{teamVotes[player.id] ? '已投' : '待投'}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {phase === 'mission_vote' ? (
            <View className='phase-box'>
              <Text className='phase-text'>出任务队伍</Text>
              <View className='team-chip-list'>
                {players.filter((player) => selectedTeamIds.includes(player.id)).map((player) => (
                  <Text key={player.id} className='team-chip'>{player.name}</Text>
                ))}
              </View>
              {canVoteForMission ? (
                <View className='round-vote-actions'>
                  <Button className='large-vote-button approve' loading={submitMissionVoteMutation.isPending} onClick={() => handleMissionVote(currentPlayerId, 'success')}>
                    成功
                  </Button>
                  <Button className='large-vote-button reject' loading={submitMissionVoteMutation.isPending} onClick={() => handleMissionVote(currentPlayerId, 'fail')}>
                    失败
                  </Button>
                </View>
              ) : null}
              <View className='vote-list'>
                {players.filter((player) => selectedTeamIds.includes(player.id)).map((player) => (
                  <View key={player.id} className='vote-row'>
                    <Text className='player-name'>{player.name}</Text>
                    <Text className='vote-state'>{missionVotes[player.id] ? '已投' : '待投'}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {phase === 'round_result' && latestResult ? (
            <View className='phase-box'>
              <Text className={latestResult.passed ? 'result-text good' : 'result-text evil'}>
                本轮{latestResult.passed ? '成功' : '失败'}，成功票 {latestResult.successCount}，失败票 {latestResult.failCount}
              </Text>
              <Button className='primary-button' loading={nextRoundMutation.isPending} onClick={handleNextRound}>
                下一轮
              </Button>
            </View>
          ) : null}

          {phase === 'assassination' ? (
            <View className='phase-box'>
              <Text className='result-text evil'>好人完成三次任务成功，刺客请选择梅林。</Text>
              {canAssassinate ? (
                <View className='vote-list'>
                  {players.filter((player) => player.id !== currentPlayerId).map((player) => (
                    <View key={player.id} className='vote-row'>
                      <Text className='player-name'>{player.name}</Text>
                      <Button className='small-button reject' loading={assassinateMutation.isPending} onClick={() => handleAssassinate(player.id)}>
                        刺杀
                      </Button>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className='phase-text'>等待刺客刺杀梅林</Text>
              )}
            </View>
          ) : null}

          {phase === 'finished' ? (
            <View className='phase-box'>
              <Text className={finalResultClassName}>{finalResultText}</Text>
              {assassinationResultText ? (
                <Text className={finalResultClassName}>{assassinationResultText}</Text>
              ) : null}
              {isCurrentPlayerHost ? (
                <Button className='primary-button' loading={resetGameMutation.isPending} onClick={handleRestartGame}>
                  重开对局
                </Button>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {history.length > 0 ? (
        <View className='panel'>
          <View className='panel-head'>
            <View>
              <Text className='panel-title'>回合记录</Text>
              <Text className='panel-desc'>记录队伍投票与任务结果。</Text>
            </View>
          </View>
          <View className='mission-list'>
            {history.map((result, index) => {
              const teamVotes = result.teamVotes && typeof result.teamVotes === 'object' ? result.teamVotes : {}
              const approveVoters = Object.entries(teamVotes)
                .filter(([, vote]) => vote === 'approve')
                .map(([playerId]) => getPlayerName(playerId))
              const rejectVoters = Object.entries(teamVotes)
                .filter(([, vote]) => vote === 'reject')
                .map(([playerId]) => getPlayerName(playerId))
              const teamMembers = result.teamPlayerIds.map((playerId) => getPlayerName(playerId))
              const leaderName = result.leaderPlayerId ? getPlayerName(result.leaderPlayerId) : '-'
              const hasMissionVotes = result.missionCompleted || result.successCount > 0 || result.failCount > 0
              const missionVotePlaceholder = result.status === 'team_rejected' ? '-' : '待结算'

              return (
                <View key={`${result.round}-${index}`} className='mission-item history-item'>
                  <View className='history-main'>
                    <Text className='mission-round'>第{result.round}轮</Text>
                    <Text className={getRoundStatusClassName(result.status)}>
                      {getRoundStatusText(result.status)}
                    </Text>
                  </View>
                  <View className='history-section'>
                    <Text className='history-section-title'>组队</Text>
                    <Text className='history-vote-text'>队长：{leaderName}</Text>
                    <Text className='history-vote-text'>队员：{teamMembers.join('、') || '-'}</Text>
                    <Text className='history-vote-text'>赞同组队：{result.teamVoteForced ? '强制出任务' : (approveVoters.join('、') || '-')}</Text>
                    <Text className='history-vote-text'>反对组队：{result.teamVoteForced ? '-' : (rejectVoters.join('、') || '-')}</Text>
                  </View>
                  <View className='history-section'>
                    <Text className='history-section-title'>任务</Text>
                    <Text className='history-vote-text'>成功：{hasMissionVotes ? `${result.successCount} 票` : missionVotePlaceholder}</Text>
                    <Text className='history-vote-text'>失败：{hasMissionVotes ? `${result.failCount} 票` : missionVotePlaceholder}</Text>
                  </View>
                </View>
              )
            })}
          </View>
        </View>
      ) : null}

      <View className='panel'>
        <View className='panel-head'>
          <View>
            <Text className='panel-title'>基础包配置</Text>
            <Text className='panel-desc'>{playerCount - evilCount} 好人 / {evilCount} 坏人</Text>
          </View>
        </View>
        <View className='role-grid'>
          {rolePreview.map((role, index) => (
            <View key={`${role.id}-${index}`} className={role.team === 'good' ? 'role-chip good' : 'role-chip evil'}>
              <Text>{role.name}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className='panel'>
        <View className='panel-head'>
          <View>
            <Text className='panel-title'>任务人数</Text>
            <Text className='panel-desc'>第 4 轮在 7 人及以上需要 2 张失败票。</Text>
          </View>
        </View>
        <View className='mission-list'>
          {MISSION_TABLE[playerCount].map((mission) => (
            <View key={mission.round} className='mission-item'>
              <Text className='mission-round'>第{mission.round}轮</Text>
              <Text className='mission-detail'>{mission.teamSize}人出任务</Text>
              <Text className='mission-fail'>{mission.failsRequired}败失败</Text>
            </View>
          ))}
        </View>
      </View>
      <Text className='app-version'>v{appVersion}</Text>
    </View>
  )
}
