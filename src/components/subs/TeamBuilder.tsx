import {
  Grid,
  Button,
  Paper,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  DialogContentText,
  DialogActions,
  makeStyles,
  Typography,
  Popover,
  Container,
  FormControlLabel,
  Switch,
  RadioGroup,
  FormLabel,
  Radio,
  CircularProgress,
} from "@material-ui/core";
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { UserContext } from "../../context";
import { ICardInfo, IGameChara, ISkillInfo, ITeamCardState } from "../../types";
import {
  useAlertSnackbar,
  useCachedData,
  useLocalStorage,
  useSkillMapping,
  useToggle,
} from "../../utils";
import { CardThumb, CardThumbMedium } from "./CardThumb";
import rarityNormal from "../../assets/rarity_star_normal.png";
import rarityAfterTraining from "../../assets/rarity_star_afterTraining.png";
import { teamBuildReducer } from "../../stores/reducers";
import { useStrapi } from "../../utils/apiClient";
import { useTeamCalc } from "../../utils/teamCalc";
import { useCharaName } from "../../utils/i18n";
import { attrIconMap } from "../../utils/resources";

const useStyle = makeStyles((theme) => ({
  "rarity-star-img": {
    maxWidth: "16px",
    margin: theme.spacing(0, 0.25),
  },
  "dialog-paper": {
    padding: theme.spacing(1),
    [theme.breakpoints.up("sm")]: {
      minWidth: "500px",
    },
    [theme.breakpoints.up("md")]: {
      minWidth: "700px",
    },
    [theme.breakpoints.up("lg")]: {
      minWidth: "900px",
    },
  },
}));

const TeamBuilder: React.FC<{
  teamCards: number[];
  teamCardsStates: ITeamCardState[];
  teamTotalPower: number;
  setTeamCards: React.Dispatch<React.SetStateAction<number[]>>;
  setTeamCardsStates: React.Dispatch<React.SetStateAction<ITeamCardState[]>>;
  setTeamTotalPower: React.Dispatch<React.SetStateAction<number>>;
}> = ({
  teamCards,
  teamCardsStates,
  teamTotalPower,
  setTeamCards,
  setTeamCardsStates,
  setTeamTotalPower,
}) => {
  const classes = useStyle();
  const { t } = useTranslation();
  const getCharaName = useCharaName();
  const { jwtToken, sekaiProfile, updateSekaiProfile } = useContext(
    UserContext
  )!;
  const { putSekaiDeckList, deleteSekaiDeckList } = useStrapi(jwtToken);
  const { showError, showSuccess } = useAlertSnackbar();
  const skillMapping = useSkillMapping();

  const [cards] = useCachedData<ICardInfo>("cards");
  const [charas] = useCachedData<IGameChara>("gameCharacters");
  const [skills] = useCachedData<ISkillInfo>("skills");

  const {
    getAreaItemBonus,
    getCharacterRankBonus,
    getHonorBonus,
    getPureTeamPowers,
  } = useTeamCalc();

  const [characterId, setCharacterId] = useState<number>(0);
  const [rarity, setRarity] = useState<number>(0);
  const [attr, setAttr] = useState<string>("all");
  const [filteredCards, setFilteredCards] = useState<ICardInfo[]>([]);
  const [saveTeamDialogVisible, setSaveTeamDialogVisible] = useState<boolean>(
    false
  );
  const [loadTeamDialogVisible, setLoadTeamDialogVisible] = useState<boolean>(
    false
  );
  const [addCardDialogVisible, setAddCardDialogVisible] = useState<boolean>(
    false
  );
  const [editingCard, setEditingCard] = useState<ITeamCardState>();
  const [isSyncCardState, setIsSyncCardState] = useLocalStorage(
    "team-build-use-sekai-card-state",
    false
  );
  const [storageLocation, setStorageLocation] = useState<"local" | "cloud">(
    "local"
  );
  const [isSavingEntry, toggleIsSaveingEntry] = useToggle(false);
  const [isAutoCalcBonus, toggleIsAutoCalcBonus] = useToggle(
    !!sekaiProfile?.sekaiUserProfile
  );
  const [skillSpriteName, setSkillSpriteName] = useState("any");

  const [teamBuildArray, dispatchTeamBuildArray] = useReducer(
    teamBuildReducer,
    {
      teams: JSON.parse(localStorage.getItem("team-build-array") || "[]"),
      localKey: "team-build-array",
      storageLocation: "local",
    }
  );

  useEffect(() => {
    dispatchTeamBuildArray({
      type: "reload",
      payload: {
        location: storageLocation,
        teams:
          storageLocation === "local"
            ? JSON.parse(localStorage.getItem("team-build-array") || "[]")
            : sekaiProfile?.deckList || [],
      },
    });
  }, [sekaiProfile?.deckList, storageLocation]);

  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null);
  const open = useMemo(() => Boolean(anchorEl), [anchorEl]);

  const filterCards = useCallback(() => {
    if (!cards || !cards.length || !skills || !skills.length) return;
    const skillIds = skills
      .filter((skill) => {
        if (skillSpriteName === "perfect_score_up")
          return skill.skillEffects[0].activateNotesJudgmentType === "perfect";
        else if (skillSpriteName === "life_score_up")
          return (
            skill.skillEffects[0].skillEffectType === "score_up_condition_life"
          );
        else return skill.descriptionSpriteName === skillSpriteName;
      })
      .map((skill) => skill.id);
    setFilteredCards(
      cards.filter(
        (card) =>
          (rarity > 0 ? card.rarity === rarity : true) &&
          (attr !== "all" ? card.attr === attr : true) &&
          (skillIds.length ? skillIds.includes(card.skillId) : true) &&
          (characterId ? card.characterId === characterId : true)
      )
    );
  }, [attr, cards, characterId, rarity, skillSpriteName, skills]);

  const handleCardThumbClick = useCallback(
    (card: ICardInfo) => {
      if (teamCards.some((tc) => tc === card.id)) {
        // showError(t("music_recommend:buildTeam.duplicatedCardError"));
        const index = teamCards.indexOf(card.id);
        setTeamCards((tc) => [...tc.slice(0, index), ...tc.slice(index + 1)]);
        setTeamCardsStates((tcs) => [
          ...tcs.slice(0, index),
          ...tcs.slice(index + 1),
        ]);
        return;
      } else if (teamCards.length === 5) {
        showError(t("music_recommend:buildTeam.cardMaxError"));
        return;
      }
      const maxLevel = [0, 20, 30, 50, 60];
      setTeamCards((tc) => [...tc, card.id]);
      let stateFrom = sekaiProfile?.cardList?.find(
        (cl) => cl.cardId === card.id
      );
      setTeamCardsStates((tcs) => [
        ...tcs,
        isSyncCardState && !!stateFrom
          ? stateFrom
          : {
              cardId: card.id,
              skillLevel: 1,
              masterRank: 0,
              level: maxLevel[card.rarity],
              trained: card.rarity >= 3,
              story1Unlock: true,
              story2Unlock: true,
            },
      ]);
      // setAddCardDialogVisible(false);
    },
    [
      teamCards,
      setTeamCards,
      sekaiProfile?.cardList,
      setTeamCardsStates,
      showError,
      t,
      isSyncCardState,
    ]
  );

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>, card: ITeamCardState) => {
      setAnchorEl(event.currentTarget);
      setEditingCard(card);
    },
    []
  );

  const handleClose = useCallback(() => {
    setAnchorEl(null);
    setEditingCard(undefined);
  }, []);

  const handleChange = useCallback(
    (value: any, key: string) => {
      if (editingCard) {
        const newCard = Object.assign({}, editingCard, {
          [key]: value,
        });
        setEditingCard(newCard);
        const idx = teamCards.indexOf(newCard.cardId);
        setTeamCardsStates((tcs) => [
          ...tcs.slice(0, idx),
          newCard,
          ...tcs.slice(idx + 1),
        ]);
      }
    },
    [editingCard, setTeamCardsStates, teamCards]
  );

  const handleDelete = useCallback(() => {
    if (!editingCard) return;
    const index = teamCards.indexOf(editingCard.cardId);
    setTeamCards((tc) => [...tc.slice(0, index), ...tc.slice(index + 1)]);
    setTeamCardsStates((tcs) => [
      ...tcs.slice(0, index),
      ...tcs.slice(index + 1),
    ]);
    handleClose();
  }, [editingCard, handleClose, setTeamCards, setTeamCardsStates, teamCards]);

  const handleAddTeamEntry = useCallback(() => {
    const toSaveEntry = {
      // id: teamBuildArray.teams.length + 1,
      teamCards: teamCards,
      teamCardsStates: teamCardsStates,
      teamTotalPower: teamTotalPower,
    };

    toggleIsSaveingEntry();

    if (storageLocation === "cloud") {
      if (!sekaiProfile) return;
      putSekaiDeckList(sekaiProfile.id, [toSaveEntry])
        .then(() => {
          dispatchTeamBuildArray({
            type: "add",
            payload: toSaveEntry,
          });
          updateSekaiProfile({
            deckList: [...(sekaiProfile.deckList || []), toSaveEntry],
          });
          toggleIsSaveingEntry();
        })
        .catch(() => {
          showError(t("team_build:error.save_team_failed"));
          toggleIsSaveingEntry();
        });
    } else if (storageLocation === "local") {
      dispatchTeamBuildArray({
        type: "add",
        payload: toSaveEntry,
      });
      toggleIsSaveingEntry();
    }
  }, [
    putSekaiDeckList,
    sekaiProfile,
    showError,
    storageLocation,
    t,
    teamCards,
    teamCardsStates,
    teamTotalPower,
    toggleIsSaveingEntry,
    updateSekaiProfile,
  ]);

  const handleReplaceTeamEntry = useCallback(
    (id) => {
      const currentEntry = {
        // id: id + 1,
        teamCards: teamCards,
        teamCardsStates: teamCardsStates,
        teamTotalPower: teamTotalPower,
      };

      toggleIsSaveingEntry();

      if (storageLocation === "cloud") {
        if (!sekaiProfile) return;
        putSekaiDeckList(sekaiProfile.id, [
          Object.assign({}, currentEntry, { id }),
        ])
          .then(() => {
            dispatchTeamBuildArray({
              type: "replace",
              payload: {
                id,
                data: currentEntry,
              },
            });
            updateSekaiProfile({
              deckList: [
                ...sekaiProfile!.deckList!.slice(0, id),
                currentEntry,
                ...sekaiProfile!.deckList!.slice(id + 1),
              ],
            });
            showSuccess(t("team_build:save_team_succeed"));
            toggleIsSaveingEntry();
          })
          .catch(() => {
            showError(t("team_build:error.save_team_failed"));
            toggleIsSaveingEntry();
          });
      } else if (storageLocation === "local") {
        dispatchTeamBuildArray({
          type: "replace",
          payload: {
            id,
            data: currentEntry,
          },
        });
        showSuccess(t("team_build:save_team_succeed"));
        toggleIsSaveingEntry();
      }
    },
    [
      putSekaiDeckList,
      sekaiProfile,
      showError,
      showSuccess,
      storageLocation,
      t,
      teamCards,
      teamCardsStates,
      teamTotalPower,
      toggleIsSaveingEntry,
      updateSekaiProfile,
    ]
  );

  const handleDeleteTeamEntry = useCallback(
    (id) => {
      toggleIsSaveingEntry();

      if (storageLocation === "cloud") {
        if (!sekaiProfile) return;
        deleteSekaiDeckList(sekaiProfile.id, [id])
          .then(() => {
            dispatchTeamBuildArray({
              type: "remove",
              payload: id,
            });
            updateSekaiProfile({
              deckList: [
                ...sekaiProfile!.deckList!.slice(0, id),
                ...sekaiProfile!.deckList!.slice(id + 1),
              ],
            });
            toggleIsSaveingEntry();
          })
          .catch(() => {
            showError(t("team_build:error.save_team_failed"));
            toggleIsSaveingEntry();
          });
      } else if (storageLocation === "local") {
        dispatchTeamBuildArray({
          type: "remove",
          payload: id,
        });
        toggleIsSaveingEntry();
      }
    },
    [
      deleteSekaiDeckList,
      sekaiProfile,
      showError,
      storageLocation,
      t,
      toggleIsSaveingEntry,
      updateSekaiProfile,
    ]
  );

  const handleLoadTeamEntry = useCallback(
    (idx) => {
      const currentEntry = teamBuildArray.teams[idx];
      if (
        !Object.prototype.hasOwnProperty.call(
          currentEntry.teamCardsStates[0],
          "story1Unlock"
        )
      ) {
        // convert data
        currentEntry.teamCardsStates = currentEntry.teamCardsStates.map(
          (state) => {
            const card = cards!.find((elem) => elem.id === state.cardId)!;
            const maxNormalLevel = [0, 20, 30, 50, 60];
            return Object.assign({}, state, {
              masterRank: 0,
              trained: state.level > maxNormalLevel[card.rarity],
              story1Unlock: false,
              story2Unlock: false,
            });
          }
        );
      }

      setTeamCards(currentEntry.teamCards);
      setTeamCardsStates(currentEntry.teamCardsStates);
      setTeamTotalPower(currentEntry.teamTotalPower);

      setLoadTeamDialogVisible(false);
    },
    [cards, setTeamCards, setTeamCardsStates, setTeamTotalPower, teamBuildArray]
  );

  const calcTotalPower = useCallback(
    (cardStates?) => {
      const pureDeckPower = getPureTeamPowers(cardStates || teamCardsStates);

      // console.log(
      //   isAutoCalcBonus && !!sekaiProfile && !!sekaiProfile.sekaiUserProfile
      // );
      if (isAutoCalcBonus && sekaiProfile && sekaiProfile.sekaiUserProfile) {
        const areaItemBonus = getAreaItemBonus(
          cardStates || teamCardsStates,
          sekaiProfile.sekaiUserProfile.userAreaItems
        );

        // console.log(areaItemBonus);

        const characterRankBonus = getCharacterRankBonus(
          sekaiProfile.sekaiUserProfile.userCharacters,
          cardStates || teamCardsStates
        );

        const honorBonus = getHonorBonus(
          sekaiProfile.sekaiUserProfile.userHonors
        );

        // console.log(
        //   pureDeckPower,
        //   areaItemBonus,
        //   characterRankBonus,
        //   honorBonus
        // );

        return pureDeckPower + areaItemBonus + characterRankBonus + honorBonus;
      }

      return pureDeckPower;
    },
    [
      getAreaItemBonus,
      getCharacterRankBonus,
      getHonorBonus,
      getPureTeamPowers,
      isAutoCalcBonus,
      sekaiProfile,
      teamCardsStates,
    ]
  );

  const handleLoadSekaiTeamEntry = useCallback(() => {
    if (!sekaiProfile || !sekaiProfile.sekaiUserProfile) return;

    const cardIds = Array.from({ length: 5 }).map(
      (_, idx) =>
        sekaiProfile.sekaiUserProfile!.userDecks[0][
          `member${idx + 1}` as "member1"
        ]
    );

    const cardStates: ITeamCardState[] = cardIds.map((cardId) => {
      const userCard = sekaiProfile.sekaiUserProfile!.userCards.find(
        (state) => state.cardId === cardId
      )!;

      return {
        cardId,
        level: userCard.level,
        masterRank: userCard.masterRank,
        trained: userCard.specialTrainingStatus === "done",
        skillLevel: 1,
        story1Unlock: userCard.episodes[0].scenarioStatus !== "unreleased",
        story2Unlock: userCard.episodes[1].scenarioStatus !== "unreleased",
      };
    });

    setTeamCards(cardIds);
    setTeamCardsStates(cardStates);
    // setTeamTotalPower(0);
    setTeamTotalPower(calcTotalPower(cardStates));

    setLoadTeamDialogVisible(false);
  }, [
    calcTotalPower,
    sekaiProfile,
    setTeamCards,
    setTeamCardsStates,
    setTeamTotalPower,
  ]);

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <Grid container spacing={1}>
          <Grid item>
            <Button
              variant="contained"
              color="primary"
              onClick={() => setAddCardDialogVisible(true)}
              disabled={teamCards.length === 5}
            >
              {t("music_recommend:buildTeam.addCard")}
            </Button>
          </Grid>
          <Grid item>
            <Button
              variant="contained"
              color="primary"
              onClick={() => setSaveTeamDialogVisible(true)}
              disabled={teamCards.length === 0}
            >
              {t("music_recommend:buildTeam.saveTeam")}
            </Button>
          </Grid>
          <Grid item>
            <Button
              variant="contained"
              color="primary"
              onClick={() => setLoadTeamDialogVisible(true)}
              disabled={!cards || cards.length === 0}
            >
              {t("music_recommend:buildTeam.loadTeam")}
            </Button>
          </Grid>
          <Grid item>
            <Button
              variant="contained"
              color="secondary"
              onClick={() => {
                setTeamCards([]);
                setTeamCardsStates([]);
              }}
              disabled={teamCards.length === 0}
            >
              {t("music_recommend:buildTeam.clearTeam")}
            </Button>
          </Grid>
        </Grid>
      </Grid>
      <Grid item xs={12}>
        <Grid container spacing={1} justify="center">
          {teamCards.map((cardId, index) => (
            <Grid key={`team-card-${cardId}`} item xs={4} md={2}>
              <CardThumbMedium
                cardId={cardId}
                trained={teamCardsStates[index].trained}
                level={teamCardsStates[index].level}
                masterRank={teamCardsStates[index].masterRank}
                style={{ cursor: "pointer" }}
                onClick={(e) => handleClick(e, teamCardsStates[index])}
              />
            </Grid>
          ))}
        </Grid>
      </Grid>
      <Grid item xs={12}>
        {teamCards.length > 0 && (
          <Grid container spacing={1} alignItems="center">
            <Grid item>
              <TextField
                label={t("music_recommend:buildTeam.teamPower")}
                type="number"
                InputLabelProps={{
                  shrink: true,
                }}
                value={teamTotalPower}
                onChange={(e) => setTeamTotalPower(Number(e.target.value))}
              />
            </Grid>
            <Grid item>
              <Button
                variant="contained"
                color="primary"
                onClick={() => setTeamTotalPower(calcTotalPower())}
              >
                {t("team_build:button.calc_total_power")}
              </Button>
            </Grid>
            <Grid item>
              <FormControlLabel
                control={<Switch checked={isAutoCalcBonus} />}
                onChange={() => toggleIsAutoCalcBonus()}
                label={t("team_build:auto_calc_bonus")}
                disabled={!sekaiProfile || !sekaiProfile.sekaiUserProfile}
              />
            </Grid>
          </Grid>
        )}
      </Grid>
      <Dialog
        open={addCardDialogVisible}
        onClose={() => setAddCardDialogVisible(false)}
      >
        <DialogTitle>{t("music_recommend:addCardDialog.title")}</DialogTitle>
        <DialogContent>
          <Grid container spacing={1} alignItems="center">
            <Grid item>
              <FormControl style={{ minWidth: 200 }}>
                <InputLabel id="add-card-dialog-select-chara-label">
                  {t("common:character")}
                </InputLabel>
                <Select
                  labelId="add-card-dialog-select-chara-label"
                  value={characterId}
                  onChange={(e) => setCharacterId(e.target.value as number)}
                >
                  <MenuItem value={0}>{t("common:all")}</MenuItem>
                  {charas &&
                    charas.map((chara) => (
                      <MenuItem
                        key={`chara-select-item-${chara.id}`}
                        value={chara.id}
                      >
                        {getCharaName(chara.id)}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item>
              <FormControl style={{ minWidth: 120 }}>
                <InputLabel id="add-card-dialog-select-rarity-label">
                  {t("common:rarity")}
                </InputLabel>
                <Select
                  labelId="add-card-dialog-select-rarity-label"
                  value={rarity}
                  onChange={(e) => setRarity(e.target.value as number)}
                >
                  <MenuItem key={`rarity-select-item-0`} value={0}>
                    {t("common:all")}
                  </MenuItem>
                  {Array.from({ length: 4 }).map((_, index) => (
                    <MenuItem
                      key={`rarity-select-item-${index + 1}`}
                      value={index + 1}
                    >
                      {index + 1 >= 3
                        ? Array.from({ length: index + 1 }).map((_, id) => (
                            <img
                              className={classes["rarity-star-img"]}
                              src={rarityAfterTraining}
                              alt={`star-${id}`}
                              key={`star-${id}`}
                            />
                          ))
                        : Array.from({ length: index + 1 }).map((_, id) => (
                            <img
                              className={classes["rarity-star-img"]}
                              src={rarityNormal}
                              alt={`star-${id}`}
                              key={`star-${id}`}
                            />
                          ))}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item>
              <FormControl style={{ minWidth: 60 }}>
                <InputLabel id="add-card-dialog-select-attr-label">
                  {t("common:attribute")}
                </InputLabel>
                <Select
                  labelId="add-card-dialog-select-attr-label"
                  value={attr}
                  onChange={(e) => setAttr(e.target.value as string)}
                >
                  <MenuItem key={`attr-select-item-0`} value={"all"}>
                    {t("common:all")}
                  </MenuItem>
                  {["cute", "mysterious", "cool", "happy", "pure"].map(
                    (name) => (
                      <MenuItem key={`attr-select-item-${name}`} value={name}>
                        <img
                          className={classes["rarity-star-img"]}
                          src={attrIconMap[name as "cool"]}
                          alt={`attr-${name}`}
                          key={`attr-${name}`}
                        />
                      </MenuItem>
                    )
                  )}
                </Select>
              </FormControl>
            </Grid>
            <Grid item>
              <FormControl style={{ minWidth: 200 }}>
                <InputLabel id="add-card-dialog-select-skill-label">
                  {t("card:skillName")}
                </InputLabel>
                <Select
                  labelId="add-card-dialog-select-skill-label"
                  value={skillSpriteName}
                  onChange={(e) => setSkillSpriteName(e.target.value as string)}
                >
                  <MenuItem value={"any"}>{t("common:all")}</MenuItem>
                  {skillMapping.map(
                    ({ name, descriptionSpriteName }, index) => (
                      <MenuItem
                        key={`skill-select-item-${index + 1}`}
                        value={descriptionSpriteName}
                      >
                        {name}
                      </MenuItem>
                    )
                  )}
                </Select>
              </FormControl>
            </Grid>
            <Grid item>
              <Button
                variant="contained"
                color="primary"
                onClick={() => filterCards()}
              >
                {t("common:search")}
              </Button>
            </Grid>
          </Grid>
          {!!filteredCards.length && (
            <Grid container spacing={1}>
              <Grid item>
                <FormControlLabel
                  control={
                    <Switch
                      checked={isSyncCardState}
                      onChange={(_, checked) => setIsSyncCardState(checked)}
                    />
                  }
                  label={t("team_build:use_sekai_card_state")}
                  disabled={
                    !sekaiProfile ||
                    !sekaiProfile.cardList ||
                    !sekaiProfile.cardList.length
                  }
                />
              </Grid>
            </Grid>
          )}
          <Grid container direction="row" spacing={1}>
            {filteredCards.map((card) => (
              <Grid key={`filtered-card-${card.id}`} item xs={4} md={3} lg={2}>
                <CardThumb
                  cardId={card.id}
                  onClick={() => handleCardThumbClick(card)}
                  style={{ cursor: "pointer" }}
                />
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        {/* <DialogActions></DialogActions> */}
      </Dialog>
      <Dialog
        open={saveTeamDialogVisible}
        onClose={() => setSaveTeamDialogVisible(false)}
        maxWidth="md"
      >
        <DialogTitle>{t("team_build:saveTeamDialog.title")}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("team_build:saveTeamDialog.desc")}
          </DialogContentText>
          <FormControl component="fieldset">
            <FormLabel component="legend">
              {t("team_build:storage_location.label")}
            </FormLabel>
            <RadioGroup
              row
              value={storageLocation}
              onChange={(_, v) => setStorageLocation(v as "local")}
            >
              <FormControlLabel
                value="local"
                control={<Radio />}
                label={t("team_build:storage_location.local")}
                labelPlacement="end"
              />
              <FormControlLabel
                value="cloud"
                control={<Radio />}
                label={t("team_build:storage_location.cloud")}
                labelPlacement="end"
                disabled={!sekaiProfile}
              />
            </RadioGroup>
          </FormControl>
          {storageLocation === "cloud" && (
            <DialogContentText>
              {t("team_build:storage_space")}: {teamBuildArray.teams.length} /{" "}
              {sekaiProfile!.maxDeckList}
            </DialogContentText>
          )}
          <Grid container spacing={1}>
            {teamBuildArray.teams.map((team, idx) => (
              <Grid key={`save-team-${idx}`} item xs={12}>
                <Paper variant="outlined" className={classes["dialog-paper"]}>
                  <Grid container spacing={1} alignItems="center">
                    <Grid item xs={12} md={2}>
                      <Typography># {idx + 1}</Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Grid container spacing={1}>
                        {team.teamCards.map((cardId) => (
                          <Grid
                            key={`save-team-card-${cardId}`}
                            item
                            xs={4}
                            sm={2}
                          >
                            <CardThumb cardId={cardId} />
                          </Grid>
                        ))}
                      </Grid>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Grid container spacing={1} justify="flex-end">
                        <Grid item>
                          <Button
                            variant="outlined"
                            onClick={() => handleReplaceTeamEntry(idx)}
                            disabled={isSavingEntry}
                          >
                            {t("common:replace")}
                          </Button>
                        </Grid>
                        <Grid item>
                          <Button
                            variant="outlined"
                            onClick={() => handleDeleteTeamEntry(idx)}
                            color="secondary"
                            disabled={isSavingEntry}
                          >
                            {t("common:delete")}
                          </Button>
                        </Grid>
                      </Grid>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            ))}
            {teamBuildArray.teams.length === 0 ? (
              <Typography>{t("team_build:noTeams")}</Typography>
            ) : null}
          </Grid>
        </DialogContent>
        <DialogActions>
          {isSavingEntry && <CircularProgress size={24} />}
          <Button
            variant="contained"
            color="primary"
            onClick={handleAddTeamEntry}
            disabled={
              isSavingEntry ||
              (storageLocation === "cloud" &&
                teamBuildArray.teams.length >= sekaiProfile!.maxDeckList)
            }
          >
            {t("team_build:saveNewEntry")}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={loadTeamDialogVisible}
        onClose={() => setLoadTeamDialogVisible(false)}
        maxWidth="md"
      >
        <DialogTitle>{t("team_build:loadTeamDialog.title")}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("team_build:loadTeamDialog.desc")}
          </DialogContentText>
          <DialogContentText>
            {t("user:profile.title.user_deck")}
          </DialogContentText>
          {(!!sekaiProfile && !!sekaiProfile.sekaiUserProfile && (
            <Grid container spacing={1}>
              <Grid item xs={12}>
                <Paper variant="outlined" className={classes["dialog-paper"]}>
                  <Grid container spacing={1} alignItems="center">
                    <Grid item xs={12} md={3}>
                      <Typography>
                        {t("user:profile.title.user_deck")}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Grid container spacing={1}>
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <Grid
                            key={`load-team-card-${idx + 100000}`}
                            item
                            xs={4}
                            sm={2}
                          >
                            <CardThumb
                              cardId={
                                sekaiProfile.sekaiUserProfile!.userDecks[0][
                                  `member${idx + 1}` as "member1"
                                ]
                              }
                            />
                          </Grid>
                        ))}
                      </Grid>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Grid container spacing={1} justify="flex-end">
                        <Grid item>
                          <Button
                            variant="outlined"
                            onClick={() => handleLoadSekaiTeamEntry()}
                          >
                            {t("common:load")}
                          </Button>
                        </Grid>
                      </Grid>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            </Grid>
          )) ||
            null}
          <br />
          <FormControl component="fieldset">
            <FormLabel component="legend">
              {t("team_build:storage_location.label")}
            </FormLabel>
            <RadioGroup
              row
              value={storageLocation}
              onChange={(_, v) => setStorageLocation(v as "local")}
            >
              <FormControlLabel
                value="local"
                control={<Radio />}
                label={t("team_build:storage_location.local")}
                labelPlacement="end"
              />
              <FormControlLabel
                value="cloud"
                control={<Radio />}
                label={t("team_build:storage_location.cloud")}
                labelPlacement="end"
              />
            </RadioGroup>
          </FormControl>
          <Grid container spacing={1}>
            {teamBuildArray.teams.map((team, idx) => (
              <Grid key={`load-team-${idx}`} item xs={12}>
                <Paper variant="outlined" className={classes["dialog-paper"]}>
                  <Grid container spacing={1} alignItems="center">
                    <Grid item xs={12} md={3}>
                      <Typography># {idx + 1}</Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Grid container spacing={1}>
                        {team.teamCards.map((cardId) => (
                          <Grid
                            key={`load-team-card-${cardId}`}
                            item
                            xs={4}
                            sm={2}
                          >
                            <CardThumb cardId={cardId} />
                          </Grid>
                        ))}
                      </Grid>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Grid container spacing={1} justify="flex-end">
                        <Grid item>
                          <Button
                            variant="outlined"
                            onClick={() => handleLoadTeamEntry(idx)}
                          >
                            {t("common:load")}
                          </Button>
                        </Grid>
                        <Grid item>
                          <Button
                            variant="outlined"
                            onClick={() => handleDeleteTeamEntry(idx)}
                            color="secondary"
                          >
                            {t("common:delete")}
                          </Button>
                        </Grid>
                      </Grid>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            ))}
            {!teamBuildArray.teams.length && (
              <Typography>{t("team_build:noTeams")}</Typography>
            )}
          </Grid>
        </DialogContent>
      </Dialog>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "top",
          horizontal: "center",
        }}
        transformOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
      >
        {editingCard && (
          <Container style={{ paddingTop: "1em", paddingBottom: "1em" }}>
            <Grid container direction="column" spacing={1}>
              <Grid item>
                <TextField
                  label={t("card:cardLevel")}
                  value={editingCard.level}
                  type="number"
                  onChange={(e) =>
                    handleChange(Number(e.target.value), "level")
                  }
                  inputProps={{
                    min: "1",
                  }}
                  fullWidth
                />
              </Grid>
              <Grid item>
                <TextField
                  label={t(
                    "user:profile.import_card.table.row.card_master_rank"
                  )}
                  value={editingCard.masterRank}
                  type="number"
                  onChange={(e) =>
                    handleChange(Number(e.target.value), "masterRank")
                  }
                  inputProps={{
                    min: "0",
                    max: "5",
                  }}
                  fullWidth
                />
              </Grid>
              <Grid item>
                <TextField
                  label={t("card:skillLevel")}
                  value={editingCard.skillLevel}
                  type="number"
                  onChange={(e) =>
                    handleChange(Number(e.target.value), "skillLevel")
                  }
                  inputProps={{
                    min: "1",
                    max: "4",
                  }}
                  fullWidth
                />
              </Grid>
              <Grid item>
                <FormControlLabel
                  control={<Switch checked={editingCard.trained} />}
                  label={t("card:trained")}
                  onChange={(e, checked) => handleChange(checked, "trained")}
                />
              </Grid>
              <Grid item>
                <FormControlLabel
                  control={<Switch checked={editingCard.story1Unlock} />}
                  label={t("card:sideStory1Unlocked")}
                  onChange={(e, checked) =>
                    handleChange(checked, "story1Unlock")
                  }
                />
              </Grid>
              <Grid item>
                <FormControlLabel
                  control={<Switch checked={editingCard.story2Unlock} />}
                  label={t("card:sideStory2Unlocked")}
                  onChange={(e, checked) =>
                    handleChange(checked, "story2Unlock")
                  }
                />
              </Grid>
              <Grid item>
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={() => handleDelete()}
                >
                  {t("common:delete")}
                </Button>
              </Grid>
            </Grid>
          </Container>
        )}
      </Popover>
    </Grid>
  );
};

export default TeamBuilder;
