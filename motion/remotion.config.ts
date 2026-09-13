import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
// LinkedIn re-encodes anyway; CRF 18 keeps the thin hairlines and mono type
// from turning to mush before it gets there.
Config.setCrf(18);
