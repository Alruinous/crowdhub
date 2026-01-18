import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { compare } from "bcryptjs";

export const authOptions: NextAuthOptions = {
  // 注意：使用 Credentials Provider 时，不需要 Adapter
  // Adapter 用于 OAuth 提供商的数据库会话存储
  // Credentials Provider 使用 JWT 策略，不需要数据库会话
  // adapter: PrismaAdapter(db),  // 已注释，避免与 Credentials Provider 冲突
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,

  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            console.log("[NextAuth] 缺少凭证");
            return null;
          }

          const user = await db.user.findUnique({
            where: {
              email: credentials.email,
            },
          });

          if (!user) {
            console.log("[NextAuth] 用户不存在:", credentials.email);
            return null;
          }

          // Check if user is banned
          if (user.banned) {
            console.log("[NextAuth] 用户已被封禁:", credentials.email);
            throw new Error("Your account has been banned");
          }

          const isPasswordValid = await compare(
            credentials.password,
            user.password
          );

          if (!isPasswordValid) {
            console.log("[NextAuth] 密码错误:", credentials.email);
            return null;
          }

          console.log("[NextAuth] 登录成功:", credentials.email);
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          };
        } catch (error) {
          console.error("[NextAuth] authorize 错误:", error);
          // 对于封禁用户，抛出错误；其他错误返回 null
          if (error instanceof Error && error.message.includes("banned")) {
            throw error;
          }
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async session({ token, session }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
        session.user.email = token.email as string;
        session.user.role = token.role as string;
      }

      return session;
    },
    async jwt({ token, user }) {
      const dbUser = await db.user.findFirst({
        where: {
          email: token.email as string,
        },
      });

      if (!dbUser) {
        if (user) {
          token.id = user.id;
          token.role = user.role;
        }
        return token;
      }

      return {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role,
      };
    },
  },
};
