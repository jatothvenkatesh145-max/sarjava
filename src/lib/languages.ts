/** Client-safe language registry shared by the editor, analyzer and server. */
export type Lang = "java" | "python" | "c";

export const LANGS: Record<Lang, { label: string; ext: string; file: string; judgeId: number; sample: string; tool: string }> = {
  java: {
    label: "Java",
    ext: ".java",
    file: "Main.java",
    judgeId: 62, // Java (OpenJDK 13)
    tool: "javac",
    sample: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}`,
  },
  python: {
    label: "Python",
    ext: ".py",
    file: "main.py",
    judgeId: 71, // Python 3.8
    tool: "python3",
    sample: `print("Hello, World!")`,
  },
  c: {
    label: "C",
    ext: ".c",
    file: "main.c",
    judgeId: 50, // C (GCC 9.2)
    tool: "gcc",
    sample: `#include <stdio.h>

int main(void) {
    printf("Hello, World!\\n");
    return 0;
}`,
  },
};

export function isLang(v: unknown): v is Lang {
  return v === "java" || v === "python" || v === "c";
}

export function langFromFile(name: string): Lang | null {
  const n = name.toLowerCase();
  if (n.endsWith(".java")) return "java";
  if (n.endsWith(".py")) return "python";
  if (n.endsWith(".c")) return "c";
  return null;
}

export const EXAMPLES: Record<Lang, { label: string; code: string; stdin?: string }[]> = {
  java: [
    { label: "Valid program", code: LANGS.java.sample },
    { label: "Missing semicolon", code: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello")\n    }\n}` },
    { label: "Undeclared variable", code: `public class Main {\n    public static void main(String[] args) {\n        System.out.println(value);\n    }\n}` },
    { label: "User input (Scanner)", code: `import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int number = sc.nextInt();\n        System.out.println(number * 2);\n        sc.close();\n    }\n}`, stdin: "21" },
    { label: "Runtime error", code: `public class Main {\n    public static void main(String[] args) {\n        int[] a = new int[2];\n        System.out.println(a[5]);\n    }\n}` },
  ],
  python: [
    { label: "Valid program", code: LANGS.python.sample },
    { label: "Syntax error", code: `def greet(name)\n    print("Hi", name)\n\ngreet("Ada")` },
    { label: "Indentation error", code: `def greet():\nprint("Hi")\n\ngreet()` },
    { label: "User input (input())", code: `n = int(input())\nprint(n * 2)`, stdin: "21" },
    { label: "Runtime error", code: `values = [1, 2, 3]\nprint(values[10])` },
  ],
  c: [
    { label: "Valid program", code: LANGS.c.sample },
    { label: "Missing semicolon", code: `#include <stdio.h>\n\nint main(void) {\n    printf("Hello\\n")\n    return 0;\n}` },
    { label: "Undeclared variable", code: `#include <stdio.h>\n\nint main(void) {\n    printf("%d\\n", total);\n    return 0;\n}` },
    { label: "User input (scanf)", code: `#include <stdio.h>\n\nint main(void) {\n    int n;\n    scanf("%d", &n);\n    printf("%d\\n", n * 2);\n    return 0;\n}`, stdin: "21" },
    { label: "Runtime error", code: `#include <stdio.h>\n\nint main(void) {\n    int a = 10, b = 0;\n    printf("%d\\n", a / b);\n    return 0;\n}` },
  ],
};
