export interface Boot {
	user: {
		id: string;
		displayName: string;
		email: string;
		role: "admin" | "author";
	};
	csrfToken: string;
	pendingComments: number;
}

export const boot: Boot = JSON.parse(document.getElementById("manage-boot")!.textContent!);

export const isAdmin = boot.user.role === "admin";
