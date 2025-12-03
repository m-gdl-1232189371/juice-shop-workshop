/*
 * Copyright (c) 2014-2023 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import fs = require("fs");
import { type Request, type Response, type NextFunction } from "express";
import logger from "../lib/logger";
import { pipeline } from "stream/promises";
import { request as undiciRequest } from "undici";

import { UserModel } from "../models/user";
import * as utils from "../lib/utils";
const security = require("../lib/insecurity");

const allowedExtensions = ["jpg", "jpeg", "png", "svg", "gif"] as const;

module.exports = function profileImageUrlUpload() {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (
      req.body.imageUrl !== undefined &&
      typeof req.body.imageUrl === "string"
    ) {
      const url = req.body.imageUrl;
      if (url.match(/(.)*solve\/challenges\/server-side(.)*/) !== null)
        req.app.locals.abused_ssrf_bug = true;
      const loggedInUser = security.authenticatedUsers.get(req.cookies.token);
      if (loggedInUser) {
        try {
          await handleProfileImageDownload(url, loggedInUser.data.id, next);
        } catch (err) {
          logger.warn(
            `Error retrieving user profile image: ${utils.getErrorMessage(
              err
            )}; using image link directly`
          );
          await updateProfileImage(loggedInUser.data.id, url, next);
        }
      } else {
        next(
          new Error("Blocked illegal activity by " + req.socket.remoteAddress)
        );
      }
    }
    res.location(process.env.BASE_PATH + "/profile");
    res.redirect(process.env.BASE_PATH + "/profile");
  };
};

async function handleProfileImageDownload(
  url: string,
  userId: number,
  next: NextFunction
): Promise<void> {
  const { statusCode, body } = await undiciRequest(url, {
    method: "GET",
    maxRedirections: 3,
  });

  if (statusCode !== 200 || body == null) {
    await updateProfileImage(userId, url, next);
    return;
  }

  const extension = deriveExtension(url);
  const relativePath = `/assets/public/images/uploads/${userId}.${extension}`;
  const absolutePath = `frontend/dist/frontend${relativePath}`;

  await pipeline(body, fs.createWriteStream(absolutePath));
  await updateProfileImage(userId, relativePath, next);
}

async function updateProfileImage(
  userId: number,
  value: string,
  next: NextFunction
): Promise<void> {
  try {
    const user = await UserModel.findByPk(userId);
    await user?.update({ profileImage: value });
  } catch (error) {
    next(error as Error);
  }
}

function deriveExtension(url: string): string {
  const ext = url.split(".").slice(-1)[0]?.toLowerCase();
  return allowedExtensions.includes(ext as (typeof allowedExtensions)[number])
    ? ext
    : "jpg";
}
