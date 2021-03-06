import * as faker from 'faker';

export interface User {
  title?: string;
  firstName: string;
  middleName?: string;
  lastName?: string;
  email: string;
}

export class TestUsers {
  public static generateUsers(numberOfUsers: number, emailDomain: string): User[] {
    const users: User[] = [];
    for (let i = 0; i < numberOfUsers; i++) {
      users.push(TestUsers.generateOneTestUser(emailDomain));
    }
    return users;
  }

  public static generateOneTestUser(emailDomain: string): User {
    const name = faker.name;
    return {
      email: `${name.firstName()}.${name.lastName()}${emailDomain.indexOf('@') === -1 ? '@' : ''}${emailDomain}`,
      title: name.prefix(),
      firstName: name.firstName(),
      lastName: name.lastName(),
    };
  }
}
