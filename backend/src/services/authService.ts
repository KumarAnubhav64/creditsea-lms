import { signToken } from '../utils/jwt';
import { ApiError } from '../utils/ApiError';
import { userRepository } from '../repositories/userRepository';
import { UserDoc } from '../models/User';

export interface AuthResult {
  token: string;
  user: { id: string; name: string; email: string; role: string };
}

function toAuthResult(user: UserDoc): AuthResult {
  return {
    token: signToken({ sub: user._id.toString(), role: user.role }),
    user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role },
  };
}

export const authService = {
  async register(input: { name: string; email: string; password: string }): Promise<AuthResult> {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      throw ApiError.conflict('An account with this email already exists');
    }

    // Public signup creates borrowers only; executive roles are provisioned via seed.
    const user = await userRepository.create({
      name: input.name,
      email: input.email,
      passwordHash: input.password, // hashed by the model's pre-save hook
      role: 'borrower',
    });
    return toAuthResult(user);
  },

  async login(input: { email: string; password: string }): Promise<AuthResult> {
    const user = await userRepository.findByEmail(input.email);
    if (!user || !(await user.comparePassword(input.password))) {
      throw ApiError.unauthorized('Invalid email or password');
    }
    return toAuthResult(user);
  },
};
