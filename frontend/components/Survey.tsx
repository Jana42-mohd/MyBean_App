import React from 'react';

const Survey = () => {
    const [userData, setUserData] = React.useState({
        name: '',
        babyName: '',
        age: '',
        feedback: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setUserData({ ...userData, [name]: value });
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        // Handle form submission logic here
        console.log(userData);
    };

    return (
        <form onSubmit={handleSubmit}>
            <h2>User Survey</h2>
            <label>
                Your Name:
                <input type="text" name="name" value={userData.name} onChange={handleChange} required />
            </label>
            <label>
                Baby's Name:
                <input type="text" name="babyName" value={userData.babyName} onChange={handleChange} required />
            </label>
            <label>
                Your Age:
                <input type="number" name="age" value={userData.age} onChange={handleChange} required />
            </label>
            <label>
                Feedback:
                <textarea name="feedback" value={userData.feedback} onChange={handleChange} />
            </label>
            <button type="submit">Submit</button>
        </form>
    );
};

export default Survey;