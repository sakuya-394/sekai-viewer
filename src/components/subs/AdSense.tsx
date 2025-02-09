import { Adsense } from "@ctrl/react-adsense";
import { Container, Typography } from "@material-ui/core";
import React, { Fragment, useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { UserContext } from "../../context";
import { useLayoutStyles } from "../../styles/layout";

type Props = {
  className?: string;
  style?: React.CSSProperties;
  client: string;
  slot: string;
  layout?: string;
  layoutKey?: string;
  format?: string;
  responsive?: string;
  pageLevelAds?: boolean;
};

const AdSense = (props: Props) => {
  const layoutClasses = useLayoutStyles();
  const { t } = useTranslation();
  const { user } = useContext(UserContext)!;

  const noAdRoles = useMemo(() => ["translator", "patron", "developer"], []);

  return user && noAdRoles.includes(user.role.type) ? null : (
    <Fragment>
      <Typography variant="h6" className={layoutClasses.header}>
        {t("common:advertisement")}
      </Typography>
      <Container className={layoutClasses.content}>
        <Adsense {...props} />
      </Container>
    </Fragment>
  );
};

export default AdSense;
