import { authService } from "@/lib/auth-service";
import { prisma } from "@/lib/prisma";
import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

const providers: NextAuthOptions['providers'] = [
    CredentialsProvider({
        name: "Credentials",
        credentials: {
            username: { label: "Username", type: "text" },
            password: { label: "Password", type: "password" }
        },
        async authorize(credentials) {
            if (!credentials?.username || !credentials?.password) {
                return null;
            }

            const rawUser = credentials.username.trim();
            const rawPass = credentials.password.trim();

            const authenticatedUser = await authService.authenticateWithCredentials(rawUser, rawPass);
            if (!authenticatedUser) {
                return null;
            }

            return {
                id: authenticatedUser.id,
                name: authenticatedUser.fullName || authenticatedUser.username,
                email: authenticatedUser.email || authenticatedUser.username,
                role: authenticatedUser.role,
            };
        }
    })
];

// Add Google OAuth Provider if credentials are provided
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
        })
    );
}

export const authOptions: NextAuthOptions = {
    providers,
    pages: {
        signIn: "/login",
        error: "/login",
    },
    callbacks: {
        async signIn({ user, account, profile }) {
            if (account?.provider === "google") {
                const email = (user.email || profile?.email)?.toLowerCase().trim();
                if (!email) return false;

                try {
                    // Check if user exists in database
                    let dbUser = await prisma.user.findFirst({
                        where: {
                            OR: [
                                { email: { equals: email, mode: 'insensitive' } },
                                { username: { equals: email, mode: 'insensitive' } }
                            ]
                        }
                    });

                    if (!dbUser) {
                        // Check if a team member exists with this email who hasn't had their user account initialized yet
                        const teamMember = await prisma.teamMember.findFirst({
                            where: { email: { equals: email, mode: 'insensitive' } }
                        });

                        if (teamMember) {
                            // Link/initialize account for authorized team member
                            dbUser = await prisma.user.create({
                                data: {
                                    username: email,
                                    email: email,
                                    fullName: user.name || teamMember.name,
                                    role: 'VIEWER',
                                    teamMemberId: teamMember.id,
                                    isActive: true,
                                }
                            });
                        } else {
                            // Email does not exist in the system - deny access
                            console.warn(`[Google Auth] Access denied: No registered account found for email ${email}`);
                            return false;
                        }
                    }

                    // Check if user account is active
                    if (dbUser.isActive === false) {
                        console.warn(`[Google Auth] Access denied: Account for email ${email} is inactive/disabled.`);
                        return false;
                    }

                    // Update name if missing
                    if (!dbUser.fullName && user.name) {
                        await prisma.user.update({
                            where: { id: dbUser.id },
                            data: { fullName: user.name }
                        });
                    }

                    // Attach DB fields to user object for downstream callbacks
                    user.id = dbUser.id;
                    user.role = dbUser.role;
                    user.name = dbUser.fullName || dbUser.username;
                    return true;
                } catch (error) {
                    console.error("Error linking Google user account:", error);
                    return false;
                }
            }
            return true;
        },
        async jwt({ token, user, account, trigger, session }) {
            if (user) {
                token.role = (user as any).role;
                token.id = user.id;
                token.name = user.name;
                token.supabaseId = (user as any).supabaseId;
                token.accessToken = (user as any).accessToken;
            }
            if (trigger === "update") {
                if (session?.name) {
                    token.name = session.name;
                }
                if (token.id) {
                    const dbUser = await prisma.user.findUnique({
                        where: { id: token.id as string },
                        select: { fullName: true, username: true }
                    });
                    if (dbUser) {
                        token.name = dbUser.fullName || dbUser.username;
                    }
                }
            }
            // If signing in via Google, ensure we attach database user ID and role
            if (account?.provider === "google" && (!token.role || !token.id)) {
                const dbUser = await prisma.user.findFirst({
                    where: {
                        OR: [
                            { email: { equals: token.email as string, mode: 'insensitive' } },
                            { username: { equals: token.email as string, mode: 'insensitive' } }
                        ]
                    }
                });
                if (dbUser) {
                    token.id = dbUser.id;
                    token.role = dbUser.role;
                    token.name = dbUser.fullName || dbUser.username;
                }
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as any).role = token.role;
                (session.user as any).id = token.id;
                if (token.name) {
                    session.user.name = token.name;
                }
                (session.user as any).supabaseId = token.supabaseId;
                (session as any).accessToken = token.accessToken;
            }
            return session;
        }
    },
    secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);
