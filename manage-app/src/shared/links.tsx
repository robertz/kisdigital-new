import { createLink } from "@tanstack/react-router";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import ListItemButton from "@mui/material/ListItemButton";
import MuiLink from "@mui/material/Link";

// Router-aware versions of the MUI components that navigate, so `to`,
// `params` and `search` stay type-checked against the route tree.
export const ButtonLink = createLink(Button);
export const IconButtonLink = createLink(IconButton);
export const ListItemButtonLink = createLink(ListItemButton);
export const TextLink = createLink(MuiLink);
