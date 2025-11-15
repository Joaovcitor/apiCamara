declare module '@jest/globals' {
  export interface Mock<T = any> {
    (...args: any[]): T;
    mockResolvedValue(value: T): this;
    mockReturnValue(value: T): this;
    mockImplementation(fn: (...args: any[]) => T): this;
    mockReturnThis(): this;
  }
}

declare global {
  namespace jest {
    interface Mock<T = any> {
      (...args: any[]): T;
      mockResolvedValue(value: T): this;
      mockReturnValue(value: T): this;
      mockImplementation(fn: (...args: any[]) => T): this;
      mockReturnThis(): this;
    }
  }
}

export {};