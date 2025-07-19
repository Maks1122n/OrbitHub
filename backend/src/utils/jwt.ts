import jwt from 'jsonwebtoken';
import { config } from '../config/env';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

export const generateTokens = (payload: JWTPayload) => {
  const accessToken = jwt.sign(payload, config.jwtSecret, {
    expiresIn: '24h'
  });
  
  const refreshToken = jwt.sign(payload, config.jwtRefreshSecret, {
    expiresIn: '7d'
  });
  
  return { accessToken, refreshToken };
};

export const verifyAccessToken = (token: string): JWTPayload => {
  return jwt.verify(token, config.jwtSecret) as JWTPayload;
};

export const verifyRefreshToken = (token: string): JWTPayload => {
  return jwt.verify(token, config.jwtRefreshSecret) as JWTPayload;
}; 