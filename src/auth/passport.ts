import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { env } from '../config/env';
import { findOrCreateUserByGoogle } from '../services/auth.service';

passport.use(
  new GoogleStrategy(
    {
      clientID: env.googleClientId,
      clientSecret: env.googleClientSecret,
      callbackURL: env.googleCallbackUrl,
      scope: ['profile', 'email'],
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const user = await findOrCreateUserByGoogle(profile);

        done(null, user);
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  ),
);

passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: env.jwtSecret,
    },
    (payload: { sub: string; email: string; name: string }, done) => {
      done(null, { id: payload.sub, email: payload.email, name: payload.name });
    },
  ),
);

export default passport;
